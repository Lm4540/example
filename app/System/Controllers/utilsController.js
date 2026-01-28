const axios = require('axios').default;
const Sucursal = require('../../Inventory/Models/Sucursal');
const Client = require("../../CRM/Models/Client");
const Sale = require('../../CRM/Models/Sale');
const SaleDetail = require('../../CRM/Models/SaleDetail');
const Product = require('../../Inventory/Models/Product');
const Stock = require('../../Inventory/Models/Stock');
const StockReserve = require('../../Inventory/Models/StockReserve');
const StockLocation = require('../../Inventory/Models/StockLocation');
const ClientObservation = require('../../CRM/Models/ClientObservation');
const warningController = require('../../System/Controllers/warningController');
const Employee = require('../../HRM/Models/Employee');


const Helper = require('../../System/Helpers');
const sequelize = require("../../DataBase/DataBase");
const { Op, QueryTypes } = require("sequelize");
const path = require('path');
const fs = require('fs');


const UtilsController = {

    index: async (req, res) => {
        return res.render('Utils/index', { pageTitle: 'Utilidades' });
    },


    revoke_order: async (req, res) => {
        if (!req.session.userSession.permission.includes('revoke_sales')) {
            return res.json({
                status: 'errorMessage', message: "No tienes permiso para realizar esta operación"
            });
        }

        let invoice = await Sale.findByPk(req.body.sale);

        let details = await sequelize.query(`SELECT * FROM inventory_requisition_detail WHERE requisition in (select id from inventory_requisition where _status = "open") and sale_detail in(SELECT id FROM crm_sale_detail WHERE sale = :sale_id);`, { replacements: { sale_id: invoice.id }, type: QueryTypes.SELECT });
        if (details.length > 0) {
            return res.json({
                status: 'errorMessage', message: "Antes de Anular Libera los detalles solicitados en traslado"
            });
        }

        if (invoice) {

            if (invoice._status == 'process' || invoice._status == 'closed' || invoice._status == "prepared") {

                try {
                    return await sequelize.transaction(async (t) => {
                        let details = null;
                        if (invoice.collected > 0.00) {
                            return res.json({
                                status: 'errorMessage', message: "No se puede anular esta venta porque tiene pagos asignados, reasigne los pagos para poder Anular esta venta"
                            });
                        } else if (invoice.invoice_number !== null) {
                            return res.json({
                                status: 'errorMessage', message: "No se puede anular esta venta porque ya ha Facturado"
                            });
                        }

                        //buscar el cliente y hacerle una anotacion para que quede costancia
                        let observation = await ClientObservation.create({
                            client: invoice.client,
                            createdBy: req.session.userSession.shortName,
                            observation: `Se Libero un pedido de $${Helper.money_format(Helper.fix_number(invoice.balance + invoice.delivery_amount))}`,
                        }, { transaction: t }).catch(e => next(e));


                        //Anular la venta
                        invoice._status = 'revoked';
                        invoice.revoked_at = new Date();
                        invoice.revoked_reason = req.body.reason;
                        invoice.collected = 0.00;
                        invoice.cost = 0.00;
                        invoice.payments = null;
                        invoice.in_report = false;
                        await invoice.save({ transaction: t });

                        //Liberar los detalles
                        details = await SaleDetail.findAll({
                            where: {
                                sale: invoice.id
                            }
                        }, { transaction: t });
                        let len = details.length;
                        for (let index = 0; index < len; index++) {
                            let detail = details[index];
                            let reserves = await StockReserve.findAll({
                                where: {
                                    saleId: detail.id
                                }
                            }, { transaction: t });

                            let largo = reserves.length;
                            for (let a = 0; a < largo; a++) {
                                let reserve = reserves[a];
                                let stock = await Stock.findOne({
                                    where: {
                                        sucursal: reserve.sucursal,
                                        product: reserve.product
                                    }
                                }, { transaction: t });
                                if (stock) {
                                    stock.reserved -= reserve.cant;
                                    await stock.save({ transaction: t });
                                }


                                let product = await Product.findByPk(reserve.product);
                                if (product) {
                                    product.reserved -= reserve.cant;
                                    await product.save({ transaction: t });
                                }
                                await reserve.destroy({ transaction: t });
                            }
                            //actualizar el detalle

                            detail.delivered = 0;
                            detail.reserved = 0;
                            detail.ready = 0;
                            await detail.save({ transaction: t });
                        }

                        return res.json({
                            status: 'success', invoice: invoice,
                        });

                    });

                } catch (error) {
                    return res.json({
                        status: 'error', message: "Internal Server Error", error: error.message
                    });
                }
            }

            return res.json({
                status: 'errorMessage', message: "No se puede anular esta venta porque ya ha anulado, ya ha sido entregado el producto o recolectado el pago, por favor anule unicamente la factura"
            });


        }
        return res.json({
            status: 'errorMessage', message: "Order not Found"
        });

    },

    revoke_order_old: async (req, res) => {
        if (!req.session.userSession.permission.includes('revoke_sales')) {
            return res.json({
                status: 'errorMessage', message: "No tienes permiso para realizar esta operación"
            });
        }

        let invoice = await Sale.findByPk(req.body.sale);

        if (invoice) {

            if (invoice._status == 'process' || invoice._status == 'closed' || invoice._status == "prepared") {

                try {
                    return await sequelize.transaction(async (t) => {
                        let details = null;
                        if (invoice.collected > 0.00) {
                            return res.json({
                                status: 'errorMessage', message: "No se puede anular esta venta porque tiene pagos asignados, reasigne los pagos para poder Anular esta venta"
                            });
                        } else if (invoice.invoice_number !== null) {
                            return res.json({
                                status: 'errorMessage', message: "No se puede anular esta venta porque ya ha Facturado"
                            });
                        }

                        //buscar el cliente y hacerle una anotacion para que quede costancia
                        let observation = await ClientObservation.create({
                            client: invoice.client,
                            createdBy: req.session.userSession.shortName,
                            observation: `Se Libero un pedido de $${Helper.money_format(Helper.fix_number(invoice.balance + invoice.delivery_amount))}`,
                        }, { transaction: t }).catch(e => next(e));


                        //Anular la venta
                        invoice._status = 'revoked';
                        invoice.revoked_at = new Date();
                        invoice.revoked_reason = req.body.reason;
                        invoice.collected = 0.00;
                        invoice.cost = 0.00;
                        invoice.payments = null;
                        invoice.in_report = false;
                        await invoice.save({ transaction: t });

                        //Liberar los detalles
                        details = await SaleDetail.findAll({
                            where: {
                                sale: invoice.id
                            }
                        }, { transaction: t });
                        let len = details.length;
                        for (let index = 0; index < len; index++) {
                            let detail = details[index];
                            let reserves = await StockReserve.findAll({
                                where: {
                                    saleId: detail.id
                                }
                            }, { transaction: t });

                            let largo = reserves.length;
                            for (let a = 0; a < largo; a++) {
                                let reserve = reserves[a];
                                let stock = await Stock.findOne({
                                    where: {
                                        sucursal: reserve.sucursal,
                                        product: reserve.product
                                    }
                                }, { transaction: t });
                                if (stock) {
                                    stock.reserved -= reserve.cant;
                                    await stock.save({ transaction: t });
                                }


                                let product = await Product.findByPk(reserve.product);
                                if (product) {
                                    product.reserved -= reserve.cant;
                                    await product.save({ transaction: t });
                                }
                                await reserve.destroy({ transaction: t });
                            }
                            //actualizar el detalle

                            detail.delivered = 0;
                            detail.reserved = 0;
                            detail.ready = 0;
                            await detail.save({ transaction: t });
                        }

                        return res.json({
                            status: 'success', invoice: invoice,
                        });

                    });

                } catch (error) {
                    return res.json({
                        status: 'error', message: "Internal Server Error", error: error.message
                    });
                }
            }

            return res.json({
                status: 'errorMessage', message: "No se puede anular esta venta porque ya ha anulado, ya ha sido entregado el producto o recolectado el pago, por favor anule unicamente la factura"
            });


        }
        return res.json({
            status: 'errorMessage', message: "Order not Found"
        });

    },

    revoke_order_new: async (req, res) => {
        if (!req.session.userSession.permission.includes('revoke_sales')) {
            return res.json({
                status: 'errorMessage', message: "No tienes permiso para realizar esta operación"
            });
        }

        let invoice = await Sale.findByPk(req.body.sale);

        if (invoice) {

            if (invoice._status == 'process' || invoice._status == 'closed' || invoice._status == "prepared") {
                if (invoice.collected > 0.00) {
                    return res.json({
                        status: 'errorMessage', message: "No se puede anular esta venta porque tiene pagos asignados, reasigne los pagos para poder Anular esta venta"
                    });
                } else if (invoice.invoice_number !== null) {
                    return res.json({
                        status: 'errorMessage', message: "No se puede anular esta venta porque ya ha Facturado"
                    });
                }

                /*

                let requisition_detail = await RequisitionDetail.count({
                    where: {
                        sale_detail: {
                            [Op.in]: sequelize.literal(`(select id from crm_sale_detail where sale = ${invoice.id})`)
                        },
                        requisition: {
                            [Op.in]: sequelize.literal(`(SELECT id FROM inventory_requisition WHERE _status = 'open')`)
                        },
                    }
                });

                console.log(requisition_detail);

                if (requisition_detail > 0) {
                    return res.json({
                        status: 'errorMessage', message: "Antes de Anular Libera los detalles solicitados en traslado"
                    });
                }

                */
                try {
                    let reserves = await StockReserve.findAll({
                        where: {
                            saleId: {
                                [Op.in]: sequelize.literal(`(select id from crm_sale_detail where sale = ${invoice.id})`)
                            }
                        }
                    });

                    console.log(reserves)

                    let prods = {};
                    let sucursals = {}

                    reserves.forEach(reserve => {
                        prods[reserve.product] = prods[reserve.product] != undefined
                            ? (prods[reserve.product] + reserve.cant)
                            : reserve.cant;

                        if (sucursals[reserve.sucursal] == null || sucursals[reserve.sucursal] == undefined) {
                            sucursals[reserve.sucursal] = {};
                            sucursals[reserve.sucursal][reserve.product] = reserve.cant;

                        } else {
                            sucursals[reserve.sucursal][reserve.product] = sucursals[reserve.sucursal][reserve.product] != undefined
                                ? (sucursals[reserve.sucursal][reserve.product] + reserve.cant)
                                : reserve.cant;
                        }
                    });



                    console.log(prods, sucursals)

                    /*
                                        return await sequelize.transaction(async (t) => {
                    
                                            //buscar el cliente y hacerle una anotacion para que quede costancia
                                            let observation = await ClientObservation.create({
                                                client: invoice.client,
                                                createdBy: req.session.userSession.shortName,
                                                observation: `Se Libero un pedido de $${Helper.money_format(Helper.fix_number(invoice.balance + invoice.delivery_amount))}`,
                                            }, { transaction: t });
                    
                                            //Anular la venta
                                            invoice._status = 'revoked';
                                            invoice.revoked_at = new Date();
                                            invoice.revoked_reason = req.body.reason;
                                            invoice.collected = 0.00;
                                            invoice.cost = 0.00;
                                            invoice.payments = null;
                                            invoice.in_report = false;
                                            await invoice.save({ transaction: t });
                    
                                            //Actualizar los detalles
                                            await sequelize.query(
                                                "UPDATE `crm_sale_detail` SET `ready` = 0,`delivered` = 0,`reserved` = 0 WHERE sale = :sale_id;",
                                                {
                                                    replacements: {
                                                        sale_id: invoice.id
                                                    },
                                                    type: QueryTypes.UPDATE,
                                                    transaction: t
                                                }
                                            );
                    
                                            await sequelize.query(
                                                "DELETE FROM `inventory_product_stock_reserve` WHERE saleId in (select id from crm_sale_detail where sale = :sale_id);",
                                                {
                                                    replacements: {
                                                        sale_id: invoice.id
                                                    },
                                                    type: QueryTypes.DELETE,
                                                    transaction: t
                                                }
                                            );
                    
                                            await sequelize.query(
                                                `DELETE FROM inventory_requisition_detail WHERE sale_detail in (select id from crm_sale_detail where sale = :sale_id) and requisition in (SELECT id FROM inventory_requisition WHERE _status = 'open');`,
                                                {
                                                    replacements: {
                                                        sale_id: invoice.id
                                                    },
                                                    type: QueryTypes.DELETE,
                                                    transaction: t
                                                }
                                            );
                    
                                            // 
                    
                                            let _tmp = Object.keys(stocks_);
                                            for (let index = 0; index < _tmp.length; index++) {
                                                await sequelize.query(
                                                    "UPDATE `inventory_product_stock` SET `reserved` = reserved - :cant WHERE `inventory_product_stock`.`id` = :stock_id;",
                                                    {
                                                        replacements: {
                                                            cant: stocks_[_tmp[index]],
                                                            stock_id: _tmp[index]
                                                        },
                                                        type: QueryTypes.UPDATE,
                                                        transaction: t
                                                    }
                                                );
                                            }
                    
                                            //actualizar los productos    
                    
                                            _tmp = Object.keys(products_);
                                            for (let index = 0; index < _tmp.length; index++) {
                                                await sequelize.query(
                                                    "UPDATE `inventory_product` SET `reserved` = reserved - :cant WHERE id = :product_id",
                                                    {
                                                        replacements: {
                                                            cant: products_[_tmp[index]],
                                                            product_id: _tmp[index]
                                                        },
                                                        type: QueryTypes.UPDATE,
                                                        transaction: t
                                                    }
                                                );
                                            }
                    
                                            return res.json({
                                                status: 'success', invoice: invoice,
                                            });
                    
                                        });
                    
                                        */

                } catch (error) {

                    console.log(error)
                    return res.json({
                        status: 'error', message: "Internal Server Error", error: error.message
                    });
                }
            }

            return res.json({
                status: 'errorMessage', message: "No se puede anular esta venta porque ya ha anulado, ya ha sido entregado el producto o recolectado el pago, por favor anule unicamente la factura"
            });


        }
        return res.json({
            status: 'errorMessage', message: "Order not Found"
        });

    },

    open_order: async (req, res) => {

        if (!req.session.userSession.permission.includes('reopen_sales')) {
            return res.json({
                status: 'errorMessage', message: "No tienes permiso para realizar esta operación"
            });
        }
        let invoice = await Sale.findByPk(req.body.order);

        if (invoice) {

            try {
                return await sequelize.transaction(async (t) => {
                    let details = null;
                    if (invoice._status == 'closed' || invoice._status == 'prepared') {
                        if (invoice.collected > 0.00) {
                            return res.json({
                                status: 'errorMessage', message: "No se puede abrir esta venta porque tiene pagos asignados, reasigne los pagos para poder Abrir"
                            });
                        }
                        if (invoice.invoice_number !== null) {
                            return res.json({
                                status: 'errorMessage', message: "No se puede abrir esta venta porque ya ha Facturado la misma"
                            });
                        }
                        //Anular la venta
                        invoice._status = 'process';
                        invoice.in_report = false;
                        await invoice.save({ transaction: t });

                        return res.json({
                            status: 'success', invoice: invoice,
                        });
                    }
                    return res.json({
                        status: 'errorMessage', message: "No se puede abrir esta venta"
                    });
                });
            } catch (error) {
                return res.json({
                    status: 'error', message: "Internal Server Error", error: error.message
                });
            }
        }
        return res.json({
            status: 'errorMessage', message: "Order not Found"
        });
    },

    recalcular_costo: async (req, res) => {
        let sale = await Sale.findByPk(req.body.sale_id);


        if (sale) {
            //buscar los movimientos e indexarlos
            let tmp = await sequelize.query(
                'SELECT * FROM `inventory_product_movement` WHERE sale_detail in (select id from crm_sale_detail where sale = :sale_id)',
                {
                    replacements: { sale_id: sale.id },
                    type: QueryTypes.SELECT,
                }
            );
            let moves = {};

            tmp.forEach(element => moves[element.sale_detail] = element.cost);
            //buscar los detalles
            let details = await SaleDetail.findAll({
                where: {
                    sale: sale.id
                }
            });

            try {
                return await sequelize.transaction(async (t) => {
                    let suma = 0.00;
                    for (let index = 0; index < details.length; index++) {
                        let dt = details[index];
                        let _cost = 0.00;
                        if (moves[dt.id] !== null && moves[dt.id]) {
                            _cost = moves[dt.id]
                        } else {
                            //buscar el costo del producto
                            console.log("Costo no encontrado en los movimientos para el detalle ", dt.id);
                            let product = await Product.findByPk(dt.product);
                            if (product) {
                                _cost = product.cost;
                            } else {
                                throw new Error(`Ningun costo encontrado! producto ${dt.product} detalle ${dt.id}`);
                            }
                        }
                        if (_cost > 0.00) {
                            dt.product_cost = _cost;
                            await dt.save({ transaction: t });
                            suma = Helper.fix_number(suma + (_cost * dt.cant));
                        } else {
                            console.log("Costo cero en el detalle ", dt.id);
                        }

                    }

                    sale.cost = suma;
                    await sale.save({ transaction: t });

                    return res.json({ status: 'success', message: 'Costo de Venta Actualizado!', sale });
                });
            } catch (error) {
                console.error(error);
                return res.json({ status: 'errorMessage', message: error.message, data: error });
            }
        }

        return res.json({
            status: 'error',
            message: 'Sale not Found',
        });


    },


    getImageFromUrl: async (req, res) => {
        try {
            let url = req.query.link;
            console.log(url);
            let image = await axios.get(url, { responseType: 'arraybuffer' });
            res.send('data:image/jpg;base64,' + Buffer.from(image.data).toString('base64'));
            //res.send('this is a response');
        } catch (error) {
            console.log(error)
        }


        /*
        try {
            const url = req.query.url;
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            res.writeHead(200, {
                'Content-Type': 'image/jpeg',
                'Content-Length': response.data.byteLength
            });
            res.end(Buffer.from(response.data).toString('base64'));
        } catch (error) {
            console.log(error);
            res.status(404).send("This URL not contains Image or itsn't available");
        }
        */
    },


    //limpioando directorios de imagenes
    cleanImagesDir: async (req, res) => {
        let __name = path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images');

        console.log(__name);
        let _files = fs.readdirSync(__name);
        let _files_deleted = [];
        let clean_list = [];
        let list = await sequelize.query('SELECT DISTINCT(image) FROM `inventory_product` where 1', {
            type: QueryTypes.SELECT
        });
        list.forEach(obj => clean_list.push(obj.image));
        _files.forEach(file_name => {
            if (!clean_list.includes(file_name)) {
                _files_deleted.push(file_name);
                try {
                    fs.unlinkSync(path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images', file_name));
                } catch (err) {
                    console.log(err)
                }
            }
        })
        return res.json(_files_deleted);
    },

    prods_to_delete: async (req, res) => {
        let details = await sequelize.query(`SELECT * FROM inventory_product WHERE id not in(select DISTINCT(product) from inventory_product_movement where 1);`, { Type: QueryTypes.SELECT, model: Product });

        return res.render('Utils/product_list_to_delete', { pageTitle: 'productos que se pueden eliminar', details });
    },

    links_reservados: async (req, res) => {
        links = [
            {
                link: '',
                name: ''
            }
        ]
    },


    reporte1: async (req, res) => {
        //buscar las ventas finalizadas en los ultimos dos meses, el estado debe ser collected y seran divididas por sucursal(parametro get), no se incluiran ventas de cliente de proceso
        let sucursal = await Sucursal.findByPk(req.query.sucursal ? req.query.sucursal : 1);
        let sucursals = await Sucursal.findAll();
        var fecha = null;
        if (req.query.date) {
            fecha = new Date(req.query.date);
        } else {
            fecha = new Date();
            fecha.setMonth(fecha.getMonth() - 2);
        }

        let tmp = await sequelize.query(`select * from crm_client where id in (SELECT client FROM crm_sale WHERE sucursal = ${sucursal.id} and _status = 'collected' and endAt >= :fecha)`, {
            replacements: { fecha: fecha },
            type: QueryTypes.SELECT,
            model: Client
        });


        let clients = {};
        tmp.forEach(client => {
            clients[client.id] = {
                name: client.name,
                id: client.id,
                sales: [],
                amount: 0.00,
                delivery: 0,
                local: 0,
            };
        });

        tmp = await Sale.findAll({
            where: {
                sucursal: sucursal.id,
                _status: 'collected',
                endAt: {
                    [Op.gte]: fecha
                }
            },
        });

        tmp.forEach(sale => {
            if (sale.client && clients[sale.client]) {
                clients[sale.client].sales.push(sale);
                clients[sale.client].amount = Helper.fix_number(clients[sale.client].amount + sale.balance + sale.delivery_amount);
                sale.delivery_type == "delivery" ? clients[sale.client].delivery++ : clients[sale.client].local++;
            }
        });


        let keys = Object.keys(clients);

        return res.render('Utils/reporte1', { clients, keys, sucursal, sucursals });
    },

    revision_de_totales: async (req, res) => {
        var { init, end, seller, sucursal } = req.query;
        seller = Number.parseInt(seller);
        sucursal = Number.parseInt(sucursal);


        console.log(req.query)

        let sales;
        let totals = {};

        let tmp = await Employee.findAll();
        let employees = {};
        tmp.forEach(obj => {
            employees[obj.id] = obj.shortName || obj.name;
        });

        //buscar las ventas
        if (!isNaN(seller) && seller > 0) {
            sales = await Sale.findAll({
                where: {
                    createdAt: {
                        [Op.between]: [
                            new Date(`${init}T00:00:00Z`),
                            new Date(`${end}T23:59:59Z`)
                        ]
                    },
                    seller: seller,
                }
            });

            tmp = await sequelize.query(`SELECT sale, SUM(price * cant) as sub FROM crm_sale_detail WHERE sale in (select id from crm_sale where seller = :seller and createdAt >= :init and createdAt <= :end) group by sale`, {
                replacements: {
                    seller: seller,
                    init: new Date(`${init}T00:00:00Z`),
                    end: new Date(`${end}T23:59:59Z`)
                },
                type: QueryTypes.SELECT
            });

            console.log(tmp)

            tmp.forEach(obj => {
                totals[obj.sale] = obj.sub;
            });
        } else if (!isNaN(sucursal) && sucursal > 0) {
            sales = await Sale.findAll({
                where: {
                    createdAt: {
                        [Op.between]: [
                            new Date(`${init}T00:00:00Z`),
                            new Date(`${end}T23:59:59Z`)
                        ]
                    },
                    sucursal: sucursal,
                },
            });

            tmp = await sequelize.query(`SELECT sale, SUM(price * cant) as sub FROM crm_sale_detail WHERE sale in (select id from crm_sale where sucursal = :sucursal and createdAt >= :init and createdAt <= :end) group by sale`, {
                replacements: {
                    sucursal: sucursal,
                    init: new Date(`${init}T00:00:00Z`),
                    end: new Date(`${end}T23:59:59Z`)
                },
                type: QueryTypes.SELECT
            });

            console.log(tmp)

            tmp.forEach(obj => {
                totals[obj.sale] = obj.sub;
            });
        } else {
            return res.json({
                error: 'nada que mostrar',
            })
        }
        let fails = [];
        // vamos a recorrer las ventas y ver si el monto es el mismo que la suma de los detalles
        sales.forEach(sale => {
            if (Number.parseFloat(sale.balance) != Number.parseFloat(totals[sale.id])) {
                warningController.logInternalWarning({
                    usuario: 'Sistema', // el usuario logueado en tu POS
                    tipo: 'permiso',
                    descripcion: `El total no coiuncide de la venta ${sale.id} : $${sale.balance} y sumatoria $${totals[sale.id]}`,
                    proceso: 'Registro de Compras',
                    usuario_auditado: employees[sale.seller]

                });

                fails.push({

                    sale: sale.id,
                    amount: sale.balance,
                    seller: employees[sale.seller],
                    detalles: totals[sale.id],

                });
            }
        });

        return res.json({
            fails
        })


    },

    execute_sql: async (req, res) => {
        let tmp = await sequelize.query(
            'SELECT * from inventory_product_stock_locations WHERE sucursal = 1 AND (location LIKE "%Bodega #5" OR location LIKE "%Bodega #10")',
            {
                type: QueryTypes.SELECT,
                model: StockLocation
            }
        );

        let result = []

        for (let index = 0; index < tmp.length; index++) {
            const element = tmp[index];
            element.location = 'Bodega #10';
            result.push(await element.save());
        }


       return res.json(result);

    }
};

module.exports = UtilsController;