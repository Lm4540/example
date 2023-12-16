const Sucursal = require('../../Inventory/Models/Sucursal');
const Client = require("../Models/Client");
const Sale = require('../Models/Sale');
const SaleDetail = require('../Models/SaleDetail');
const InvoiceSeries = require('../Models/InvoiceSerie');
const SalePayment = require('../Models/SalePayment');
const Product = require('../../Inventory/Models/Product');
const Stock = require('../../Inventory/Models/Stock');
const StockReserve = require('../../Inventory/Models/StockReserve');
const Movement = require("../../Inventory/Models/Movements");
const Provider = require("../../Inventory/Models/Provider");
const PettyCashMoves = require('../../Financial/Models/PettyCashMoves');
const Employee = require('../../HRM/Models/Employee');


const Helper = require('../../System/Helpers');
const sequelize = require("../../DataBase/DataBase");
const { Op, QueryTypes } = require("sequelize");
const path = require('path');
const fs = require('fs');

const Budget = require('../Models/Budget');
const BudgetDetail = require('../Models/BudgetDetail');
const Invoice = require('../Models/Invoice');
const InvoiceDetail = require('../Models/InvoiceDetail');

const Money = require('../../System/Money');
const { type } = require('os');

const status = {
    'process': 'En Proceso',
    'prepared': "paquete preparado",
    'transport': "En Ruta",
    'delivered': 'Entregado',
    'collected': "En espera de Remuneración",
    'revoking': "Revocando / Liberando",
    'revoked': "Revocado",
    'delivery_failed': "Entrega Fallida",
    'to_resend': "Marcado para reenvio",
    'closed': 'Cerrado'
}




const SaleController = {

    createPayment: async (req, res) => {
        let data = req.body;
        let client = await Client.findByPk(data.client);
        if (client) {

            //verificar los datos
            if (data.method != 'money' && (data.bank.length < 4 || data.reference.length < 4)) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Proporcione el Nombre del Banco y el numero de referencia de la Transacción'
                });
            } else if (isNaN(data.amount) || data.amount < 0.01) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Monto no valido'
                });

            } else {
                let sucursal = await Sucursal.findByPk(data.sucursal);
                if (sucursal == null) {
                    return res.json({
                        status: 'errorMessage',
                        message: 'Sucursal no Encontrada'
                    });
                }

                try {
                    return await sequelize.transaction(async (t) => {
                        let registered_payment = null;

                        data.amount = Number.parseFloat(data.amount);
                        //token
                        if (data.method == 'money') {
                            //generar el Ingreso a la caja Chica
                            let _move = await PettyCashMoves.create({
                                amount: data.amount,
                                last_amount: sucursal.balance,
                                concept: `Ingreso por Anticipo Cliente ${client.name} `,
                                petty_cash: sucursal.id,
                                type: 'payment',
                                isin: true,
                                createdBy: req.session.userSession.shortName,
                                asigned_to: client.name,
                                _number: 0,
                            }, { transaction: t });

                            registered_payment = await SalePayment.create({
                                client: client.id,
                                sales: [],
                                type: 'money',
                                amount: data.amount,
                                asigned_amount: 0.00,
                            }, { transaction: t });

                            sucursal.balance += data.amount;
                            await sucursal.save({ transaction: t });
                        } else {
                            registered_payment = await SalePayment.create({
                                client: client.id,
                                sales: [],
                                type: data.method,
                                amount: data.amount,
                                asigned_amount: 0.00,
                                bank: data.bank,
                                reference: data.reference,
                            }, { transaction: t });


                        }

                        client.payments += registered_payment.amount;
                        await client.save({ transaction: t });

                        return res.json({
                            status: 'success',
                            message: 'pago registrado',
                            data: registered_payment.id,
                        });
                    });

                } catch (error) {
                    console.log(error);
                    return res.json({
                        status: 'errorMessage',
                        message: error.message,
                    });
                }





            }

        }

        return Helper.notFound(req, res, 'Client not Found!')
    },


    relacionar_pago: async (req, res) => {


        try {
            //buscar el pago
            let registered_payment = await SalePayment.findByPk(req.body.id);
            //buscar el cliente
            let client = await Client.findByPk(registered_payment.client);
            // client.payments = (client.payments != null ? client.payments + registered_payment.amount : registered_payment.amount);

            return await sequelize.transaction(async (t) => {
                // await client.save({ transaction: t });

                let sales = await Sale.findAll({
                    where: {
                        client: client.id,
                        _status: {
                            [Op.notIn]: ['process', 'collected', 'revoked'],
                        },
                        collected: sequelize.literal('collected < (balance + delivery_amount)')
                    }
                });
                if (sales.length > 0) {


                    let valor_restante = registered_payment.amount;
                    let ids_registro = [];
                    let len = sales.length;

                    for (let index = 0; index < len; index++) {
                        let sale = sales[index];
                        if (valor_restante > 0) {
                            let _collected = Number.parseFloat(sale.collected);
                            _collected = isNaN(_collected) ? 0.00 : _collected;
                            let sale_value = (Number.parseFloat(sale.balance) + Number.parseFloat(sale.delivery_amount) - _collected);
                            console.log('array de pagos', sale.payments);


                            if (sale_value > valor_restante) {

                                sale.collected = (_collected + valor_restante);

                                if (sale.payments.length > 0) {
                                    sale.payments.push({ "id": registered_payment.id, "amount": valor_restante })
                                } else {
                                    sale.payments = [{ "id": registered_payment.id, "amount": valor_restante },];
                                }

                                if (sale.balance + sale.delivery_amount - sale.collected == 0) {
                                    sale._status = sale._status == 'delivered' ? 'collected' : sale._status;
                                }


                                await sale.save({ transaction: t });
                                ids_registro.push({ "id": sale.id, "amount": valor_restante });
                                valor_restante = 0;
                            } else {
                                sale.collected = (_collected + sale_value);
                                if (sale.payments.length > 0) {
                                    sale.payments.push({ "id": registered_payment.id, "amount": sale_value })
                                } else {
                                    sale.payments = [{ "id": registered_payment.id, "amount": sale_value }];
                                }

                                sale._status = sale._status == 'delivered' ? 'collected' : sale._status;

                                await sale.save({ transaction: t });
                                ids_registro.push({ "id": sale.id, "amount": sale_value });
                                valor_restante -= sale_value;
                            }
                        } else {
                            break;
                        }

                    }

                    registered_payment.sales = ids_registro;
                    registered_payment.asigned_amount = registered_payment.amount - valor_restante;
                    await registered_payment.save({ transaction: t });



                    return res.json({
                        status: 'success',
                        message: 'pago registrado',
                        data: registered_payment,
                    });
                }

                return res.json({
                    status: 'error',
                    message: 'No hay Ventas que relacionar',
                    data: registered_payment,
                });
            });



        } catch (error) {
            console.log(error);
            return res.json({
                status: 'errorMessage',
                message: error.message,
            });
        }


        //buscar las compras del cliente que esten pendientes de pago



    },

    invoice_options: async (req, res) => {
        let tmp = await Sucursal.findAll();
        let sucursals = {};
        tmp.forEach(s => sucursals[s.id] = s.name);

        let types = {
            fcf: 'Factura de Consumidor Final',
            ccf: 'Comprobante de Credito Fiscal',
            fex: 'Factura de Exportacion',
            nr: 'Nota de Remision',
            nc: 'Nota de Crédito',
            nd: 'Nota de Debito',
        };

        tmp = await InvoiceSeries.findAll({
            where: {
                active: 1,
                sucursal: req.session.userSession.employee.sucursal,
            },
            order: [['id', 'DESC'],],
            raw: true
        });

        let series = {};
        tmp.forEach(serie => {
            let s = serie;
            s.sucursal_name = sucursals[serie.sucursal];
            s.number = serie.init + serie.used;
            s.type_name = types[s.type];
            series[s.id] = s;
        });

        return res.json(series);

    },

    invoice_serie: async (req, res) => {
        let sucursals = await Sucursal.findAll();
        let series = await InvoiceSeries.findAll({
            order: [['id', 'DESC'],]
        });
        let types = {
            fcf: 'Factura de Consumidor Final',
            ccf: 'Comprobante de Credito Fiscal',
            fex: 'Factura de Exportacion',
            nr: 'Nota de Remision',
            nc: 'Nota de Crédito',
            nd: 'Nota de Debito',
        };


        return res.render('CRM/Sales/invoiceSeries', { pageTitle: 'Numeros de Serie', sucursals, series, types });
    },


    save_invoice_serie: async (req, res) => {
        let data = req.body;

        if (data.serieName.length < 4) {
            return res.json({
                status: 'errorMessage',
                message: "Coloque el numero de Serie"
            })
        } else if (isNaN(data.desde) || data.desde < 1) {
            return res.json({
                status: 'errorMessage',
                message: 'Proporcione el numero de inicio de la serie'
            })

        } else if (isNaN(data.hasta) || data.hasta < 1 || data.hasta < data.desde) {
            return res.json({
                status: 'errorMessage',
                message: 'Proporcione el numero de final de la serie'
            })
        }

        //buscar a ver si ya existe la serie
        let serie = await InvoiceSeries.findAll({
            where: {
                serie: data.serieName
            }
        });


        if (serie.length > 0) {
            return res.json({
                status: 'errorMessage',
                message: 'Esta serie ya esta registrada'
            })
        }

        serie = await InvoiceSeries.create({
            init: data.desde,
            end: data.hasta,
            serie: data.serieName,
            type: data.type,
            used: 0,
            active: true,
            sucursal: data.sucursal
        });


        return res.json({
            status: 'success',
            message: 'Guardado con Exito'
        })
    },

    update_invoice_serie: async (req, res) => {
        let data = req.body;

        if (data.serieName.length < 4) {
            return res.json({
                status: 'errorMessage',
                message: "Coloque el numero de Serie"
            })
        } else if (isNaN(data.desde) || data.desde < 1) {
            return res.json({
                status: 'errorMessage',
                message: 'Proporcione el numero de inicio de la serie'
            })

        } else if (isNaN(data.hasta) || data.hasta < 1 || data.hasta < data.desde) {
            return res.json({
                status: 'errorMessage',
                message: 'Proporcione el numero de final de la serie'
            })
        }

        serie = await InvoiceSeries.findByPk(data.serie_id);
        if (serie !== null) {

            serie.init = data.desde;
            serie.end = data.hasta;
            serie.sucursal = data.sucursal;
            await serie.save();
            return res.json({
                status: 'success',
                message: 'Guardado con Exito'
            })
        }

        return res.json({
            status: 'errorMessage',
            message: 'Serie no encontrada'
        })


    },

    history: async (req, res) => {
        const sucursals = await Sucursal.findAll();
        return res.render('CRM/Sales/history', { pageTitle: 'Historial de ventas', sucursals });
    },
    historyData: async (req, res) => {
        let init = req.query.init;
        let end = req.query.end;
        let sucursal = req.query.sucursal;

        //buscar las compras


        //


    },

    inProccess: async (req, res) => {
        //Buscar las ventas que no esten finalizadas
        let sales = await Sale.findAll({
            where: {
                _status: {
                    [Op.notIn]: ['collected', 'revoked'],
                }
            }
        });


        //estados de las ventas



        //buscar los clientes
        let tmp = await Client.findAll({
            where: {
                id: { [Op.in]: sequelize.literal('(SELECT client FROM `crm_sale` WHERE _status not in ("revoked", "collected"))') }
            }
        });
        let clients = {};
        tmp.forEach(e => clients[e.id] = e.name);
        //los vendedores

        tmp = await Employee.findAll({
            where: {
                id: { [Op.in]: sequelize.literal('(SELECT seller FROM `crm_sale` WHERE _status not in ("revoked", "collected"))') }
            }
        });
        let sellers = {};
        tmp.forEach(e => sellers[e.id] = e.name);

        tmp = await Sucursal.findAll();
        let sucursals = {};
        tmp.forEach(el => sucursals[el.id] = el.name);

        //pasar los datos
        return res.render('CRM/Sales/inProccess', { pageTitle: 'Venta en Sala', sucursals, sellers, clients, sales, status });


    },

    addDetail: async (req, res) => {
        let data = req.body;
        if (data.cant < 1) {
            return res.json({ status: 'errorMessage', message: 'Agrega una cantidad' });
        } else if (data.price < 0 || data.price == "") {
            return res.json({ status: 'errorMessage', message: 'El precio no es valido' });
        } else if (data.client < 1 || data.client == "") {
            return res.json({ status: 'errorMessage', message: 'Cliente no seleccionado' });
        }

        //buscar el cliente
        let client = await Client.findByPk(data.client).catch(err => next(err));
        if (client == null) {
            return res.json({ status: 'errorMessage', message: 'Cliente no seleccionado' });
        }

        try {
            data.cant = Number.parseInt(data.cant);
            data.price = Number.parseFloat(data.price);

            const result = await sequelize.transaction(async (t) => {
                let sale = null, detail_count = 0;

                if (data.sale == "" || data.sale == null) {
                    sale = await Sale.create({
                        client: client.id,
                        seller: req.session.userSession.employee.id,
                        sucursal: req.session.userSession.employee.sucursal,
                        credit_conditions: 0,
                        _status: 'process',
                        type: client.type,
                        balance: 0.00
                    }, { transaction: t });
                } else {
                    sale = await Sale.findByPk(data.sale);
                    detail_count = await SaleDetail.count({ where: { sale: sale.id } });
                }

                let detail = {
                    sale: sale.id,
                    product: null,
                    price: data.price,
                    description: null,
                    image: null,
                    _order: detail_count,
                    cant: data.cant,
                    ready: 0,
                    delivered: 0,
                    reserved: 0
                };

                sale.balance = Number.parseFloat(sale.balance) + (data.cant * data.price);
                await sale.save({ transaction: t });
                let existe = null;
                if (data.case == 'inventory') {
                    //buscar el productoo
                    let product = await Product.findByPk(data.product);
                    if (product == null) {
                        t.rollback();
                        return res.json({ status: 'errorMessage', message: 'Producto no encontrado' });
                    }
                    //buscar a ver si ya hay un detalle existente
                    existe = await SaleDetail.findOne({
                        where: {
                            [Op.and]: {
                                sale: sale.id,
                                product: product.id,
                                price: data.price
                            }
                        }
                    });

                    if (existe !== null) {
                        existe.cant += data.cant;
                        await existe.save({ transaction: t })
                    } else {
                        detail.description = product.name;
                        detail.product = product.id;
                        detail.image = product.raw_image_name;
                    }

                } else {
                    detail.description = data.description;

                    let image_name = null;
                    if (data.image.length > 1) {
                        image_name = 'sd_temp_' + Helper.generateNameForUploadedFile() + '.jpg';
                        let location = path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images', image_name);
                        let image_data = data.image.slice(23);
                        fs.writeFile(location, image_data, 'base64', (err) => { if (err) { console.log(err) } });
                    }
                    detail.image = image_name;
                }

                //buscar ah ver si existe un detalle anterior
                detail = existe !== null ? existe : await SaleDetail.create(detail, { transaction: t });

                if (data.case == 'inventory') {
                    //buscar los stock e indexarlos
                    let tmp = await sequelize.query('SELECT * FROM `inventory_product_stock` WHERE product = :id and cant > reserved;', {
                        replacements: { id: data.product, },
                        type: QueryTypes.SELECT,
                        model: Stock,
                    });

                    var stocks = [],
                        stock = null;
                    if (tmp.length > 0) {
                        tmp.forEach(element => {
                            if (element.sucursal == sale.sucursal) {
                                stock = element;
                            } else {
                                stocks.push(element);
                            }
                        });
                    } else {
                        t.rollback();
                        return res.json({ status: 'errorMessage', message: 'Existencias no econtradas' });
                    }


                    var faltante = data.cant;
                    //buscar el stock de la sucursal de la venta
                    if (stock != null) {
                        let disponible = stock.cant - stock.reserved;
                        if (disponible > faltante) {
                            stock.reserved += faltante;
                            await stock.save({ transaction: t });

                            //buscar una reserva que coincida con el producto, sucursal e id del detalle
                            let reserve = await StockReserve.findOne({
                                where: {
                                    [Op.and]: {
                                        type: 'sale',
                                        saleId: detail.id,
                                        product: stock.product,
                                        sucursal: stock.sucursal,
                                    }
                                }
                            });

                            if (reserve !== null) {
                                reserve.cant += faltante;
                                await reserve.save({ transaction: t });
                            } else {
                                //Si no existe, crearlo
                                reserve = await StockReserve.create({
                                    cant: faltante,
                                    createdBy: req.session.userSession.shortName,
                                    concept: 'reserva por venta',
                                    type: 'sale',
                                    saleId: detail.id,
                                    product: stock.product,
                                    sucursal: stock.sucursal,
                                }, { transaction: t });
                            }

                            faltante = 0;
                        } else {
                            stock.reserved += disponible;
                            await stock.save({ transaction: t });

                            //registrar la reserva
                            //buscar una reserva que coincida con el producto, sucursal e id del detalle
                            let reserve = await StockReserve.findOne({
                                where: {
                                    [Op.and]: {
                                        type: 'sale',
                                        saleId: detail.id,
                                        product: stock.product,
                                        sucursal: stock.sucursal,
                                    }
                                }
                            });

                            if (reserve !== null) {
                                reserve.cant += disponible;
                                await reserve.save({ transaction: t });
                            } else {
                                reserve = await StockReserve.create({
                                    cant: disponible,
                                    createdBy: req.session.userSession.shortName,
                                    concept: 'reserva por venta',
                                    type: 'sale',
                                    saleId: detail.id,
                                    product: stock.product,
                                    sucursal: stock.sucursal,
                                }, { transaction: t });
                            }
                            faltante -= disponible;
                        }
                    }

                    if (faltante > 0) {
                        for (let index = 0; index < stocks.length; index++) {
                            const stock = stocks[index];
                            if (faltante > 0) {
                                let disponible = stock.cant - stock.reserved;
                                if (disponible > faltante) {
                                    stock.reserved += faltante;
                                    await stock.save({ transaction: t });

                                    //buscar una reserva que coincida con el producto, sucursal e id del detalle
                                    let reserve = await StockReserve.findOne({
                                        where: {
                                            [Op.and]: {
                                                type: 'sale',
                                                saleId: detail.id,
                                                product: stock.product,
                                                sucursal: stock.sucursal,
                                            }
                                        }
                                    });

                                    if (reserve !== null) {
                                        reserve.cant += faltante;
                                        await reserve.save({ transaction: t });
                                    } else {
                                        //registrar la reserva
                                        reserve = await StockReserve.create({
                                            cant: faltante,
                                            createdBy: req.session.userSession.shortName,
                                            concept: 'reserva por venta',
                                            type: 'sale',
                                            saleId: detail.id,
                                        }, { transaction: t });
                                    }
                                    faltante = 0;
                                } else {
                                    stock.reserved += disponible;
                                    await stock.save({ transaction: t });

                                    //buscar una reserva que coincida con el producto, sucursal e id del detalle
                                    let reserve = await StockReserve.findOne({
                                        where: {
                                            [Op.and]: {
                                                type: 'sale',
                                                saleId: detail.id,
                                                product: stock.product,
                                                sucursal: stock.sucursal,
                                            }
                                        }
                                    });

                                    if (reserve !== null) {
                                        reserve.cant += disponible;
                                        await reserve.save({ transaction: t });
                                    } else {
                                        reserve = await StockReserve.create({
                                            cant: disponible,
                                            createdBy: req.session.userSession.shortName,
                                            concept: 'reserva por venta',
                                            type: 'sale',
                                            saleId: detail.id,
                                        }, { transaction: t });
                                    }
                                    faltante -= disponible;
                                }
                            }
                        }
                    }

                    detail.reserved += data.cant - faltante;
                    await detail.save({ transaction: t });
                }

                return res.json({ status: 'success', message: 'Guardado', data: { detail, balance: sale.balance } });
                //throw new Error();

            });
        } catch (error) {
            console.error(error);
        }
    },

    updateSaleDetail: async (req, res) => {
        let data = req.body;

        //obtener el detalle
        let detail = await SaleDetail.findByPk(data.detail_id).catch(err => next(err));

        if (detail) {
            let sale = await Sale.findByPk(detail.sale).catch(err => next(err));
            if (sale) {
                try {
                    let count = await SaleDetail.count({ where: { sale: sale.id } }) - 1;
                    const result = await sequelize.transaction(async (t) => {

                        let old_amount = Number.parseInt(detail.cant) * Number.parseFloat(detail.price);
                        data.price = data.price !== undefined ? Number.parseFloat(data.price) : 0;
                        data.cant = Number.parseInt(data.cant > detail.cant ? detail.cant : data.cant);

                        switch (data.case) {
                            case 'delete':
                                if (detail.product == null || detail.reserved == 0) {
                                    if (data.cant == detail.cant) {
                                        //actualizar el monto de la venta
                                        sale.balance = Number.parseFloat(sale.balance) - old_amount;
                                        //detruir el detalle
                                        let location = path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images', detail.img);
                                        await detail.destroy({ transaction: t });
                                        detail = null;
                                        //eliminar la imagen temporal
                                        fs.unlink(location, (err) => { if (err) { console.log(err); } else { console.log('image deleted'); } });
                                    } else {
                                        // reducir el detalle
                                        detail.cant -= data.cant;
                                        await detail.save();
                                        sale.balance = Number.parseFloat(sale.balance) - old_amount + (Number.parseInt(detail.cant) * Number.parseFloat(detail.price));
                                    }
                                } else {
                                    //buscar las reservas que esten relacionadas con el stock del producto
                                    let reserves = await StockReserve.findAll({
                                        where: {
                                            [Op.and]: {
                                                saleId: detail.id,
                                                product: detail.product
                                            }
                                        },
                                        order: [['id', 'DESC']]
                                        //por la creacion se tiene como prioridad la sucursal del empleado que registra, para la eliminacion se tendra como prioridad las otras sucursales
                                    });
                                    //buscar los stock que esten relacionados con el producto, se puede optimizar
                                    let tmp = await Stock.findAll({ where: { product: detail.product }, order: [['id', 'DESC']] });
                                    let stocks = {};
                                    tmp.forEach(element => stocks[element.sucursal] = element);
                                    //Si hay producto revisado no se puede eliminar por tanto cambiaremos el valor maximo para tomar el valor de lo que no esta revisado
                                    if (detail.ready > 0) {
                                        //significa que hay parte ya revisada, la cual no se puede quitar asi por asi
                                        let revertible = detail.cant - detail.ready;
                                        if (data.cant > revertible) {
                                            let sol = data.cant - revertible;
                                            data.cant = revertible;
                                            //realizar solicitud de reversion si se quiere hacer en automatico
                                        }

                                    }
                                    if (data.cant > 0) {
                                        //si la cantidad es igual a la cantidad del detalle vamos a eliminarlo
                                        if (data.cant == detail.cant) {
                                            //buscar las reservas y destruirlas
                                            for (let index = 0; index < reserves.length; index++) {
                                                let reserve = reserves[index];
                                                let stock = stocks[reserve.sucursal];

                                                stock.reserved -= reserve.cant;
                                                await stock.save({ transaction: t });
                                                await reserve.destroy({ transaction: t });
                                            }

                                            await detail.destroy({ transaction: t });
                                            detail = null;
                                            sale.balance = Number.parseFloat(sale.balance) - old_amount;
                                        } else {

                                            //si no a reducirlo
                                            let faltante = data.cant;

                                            for (let index = 0; index < reserves.length; index++) {
                                                if (faltante > 0) {
                                                    let reserve = reserves[index];
                                                    let stock = stocks[reserve.sucursal];

                                                    if (faltante > reserve.cant) {
                                                        //destruir la reserva
                                                        stock.reserved -= reserve.cant;
                                                        await stock.save({ transaction: t });
                                                        await reserve.destroy({ transaction: t });
                                                    } else {
                                                        //reducir la reserva
                                                        reserve.cant -= faltante;
                                                        stock.reserved -= faltante;
                                                        await stock.save({ transaction: t });
                                                        await reserve.save({ transaction: t });
                                                    }
                                                }
                                            }
                                            detail.cant -= data.cant;
                                            detail.reserved -= data.cant;
                                            await detail.save({ transaction: t });
                                            sale.balance = Number.parseFloat(sale.balance) - old_amount + (Number.parseInt(detail.cant) * Number.parseFloat(detail.price));
                                        }
                                    }
                                }



                                if (count < 1 && detail == null) {
                                    await sale.destroy({ transaction: t });
                                    sale = null;
                                } else {
                                    sale = await sale.save({ transaction: t });
                                }
                                return res.json({ status: 'success', message: 'Guardado', detail, balance: sale !== null ? sale.balance : null });

                                break;
                            case 'price':
                                //Restar el monto de la cuenta de la venta
                                let new_amount = data.price * detail.cant;
                                detail.price = data.price;
                                sale.balance = sale.balance - old_amount + new_amount;
                                await detail.save({ transaction: t });
                                await sale.save({ transaction: t });
                                return res.json({ status: 'success', message: 'Guardado', detail, balance: sale.balance });
                                //enviar la respuesta con el nuevo balance y el nuevo objeto detalle
                                break;
                            case 'realese request':
                                //crear el realease request
                                let release_request = null;


                                return res.json({ status: 'success', message: 'Guardado', release_request });
                                break;
                            default:
                                break;
                        }

                        console.log('sale del switch', '\n');

                    });
                } catch (error) {
                    console.error(error);
                }
            } else {
                return res.json({ status: 'errorMessage', message: 'Venta o Pedido no encontrado' });

            }
        } else {
            return res.json({ status: 'errorMessage', message: 'Detalle no encontrado' });
        }
    },

    createClientSale: async (req, res) => {
        let cliente = await Client.findByPk(req.params.id);
        let providers = await Provider.findAll({ where: { type: 'transport' } });
        let locations = {};
        providers.forEach(prov => {
            if (prov.delivery_locations !== null) {
                locations[prov.id] = prov.delivery_locations;
            }
        });

        return cliente !== null
            ? res.render('CRM/Sales/clientNewSale', {
                pageTitle: 'Registrar Venta',
                cliente,
                UserSucursal: req.session.userSession.employee.sucursal,
                providers,
                locations
            })
            : Helper.notFound(req, res, 'Client not Found');
    },

    saveNewSale: async (req, res) => {
        //obtener la data

        //Crear la venta


        //crear los detalles con la reserva

        //enviar la respuesta

        //emitir un nuevo evento para la parte de 
    },

    saleInRoomView: async (req, res) => {
        let sucursal = await Sucursal.findByPk(req.session.userSession.employee.sucursal);
        return res.render('CRM/Sales/NewSaleInRoom', { pageTitle: 'Venta en Sala', sucursal });
    },
    viewSale: async (req, res) => {
        //buscar la venta
        let sale = await Sale.findByPk(req.params.id)
        if(sale){
            
            //buscar el Cliente
            let cliente = await Client.findByPk(sale.client);
            
            if(cliente){
                //Buscar el empleado
                let seller = await Employee.findByPk(sale.seller);
                if(seller){
                    let sucursal = await Sucursal.findByPk(seller.sucursal);
                    //buscar los detalles
                    let details = await SaleDetail.findAll({
                        where: {
                            sale: sale.id
                        }
                    });


                    return res.render('CRM/Sales/view_sale', { pageTitle: 'Venta ID:'+sale.id, sucursal, sale, details, seller, cliente  });
                }
                
            }
            
        }

    },

    socket_add_detail: async (data, session) => {
        if (data.cant < 1) {
            return { status: 'errorMessage', message: 'Agrega una cantidad' };
        } else if (data.price < 0 || data.price == "") {
            return { status: 'errorMessage', message: 'El precio no es valido' };
        } else if (data.client < 1 || data.client == "") {
            return { status: 'errorMessage', message: 'Cliente no seleccionado' };
        }

        //buscar el cliente
        let client = await Client.findByPk(data.client).catch(err => next(err));
        if (client == null) {
            return { status: 'errorMessage', message: 'Cliente no seleccionado' };
        }

        try {
            data.cant = Number.parseInt(data.cant);
            data.price = Number.parseFloat(data.price);

            return await sequelize.transaction(async (t) => {
                let sale = null, detail_count = 0;

                sale = await Sale.findOne({
                    where: {
                        [Op.and]: {
                            client: data.client,
                            _status: 'process'
                        }
                    }
                });


                console.log(sale)

                // if (data.sale != "" || data.sale != null) {
                //     sale = await Sale.findByPk(data.sale);
                // }else{
                // }

                if (sale) {
                    detail_count = await SaleDetail.count({ where: { sale: sale.id } });
                }


                if (sale == null) {
                    sale = await Sale.create({
                        client: client.id,
                        seller: session.employee.id,
                        sucursal: session.employee.sucursal,
                        credit_conditions: 0,
                        _status: 'process',
                        type: client.type,
                        balance: 0.00
                    }, { transaction: t });
                }

                let detail = {
                    sale: sale.id,
                    product: null,
                    price: data.price,
                    description: null,
                    image: null,
                    _order: detail_count,
                    cant: data.cant,
                    ready: 0,
                    delivered: 0,
                    reserved: 0
                };

                sale.balance = Number.parseFloat(sale.balance) + (data.cant * data.price);
                await sale.save({ transaction: t });
                let existe = null;
                let product = null;
                if (data.case == 'inventory') {
                    //buscar el productoo
                    product = await Product.findByPk(data.product);
                    if (product == null) {
                        throw 'Producto no encontrado';

                        console.log('rollback por product not found')
                        return { status: 'errorMessage', message: 'Producto no encontrado' };
                    }
                    //buscar a ver si ya hay un detalle existente
                    existe = await SaleDetail.findOne({
                        where: {
                            [Op.and]: {
                                sale: sale.id,
                                product: product.id,
                                price: data.price
                            }
                        }
                    });

                    if (existe !== null) {
                        existe.cant += data.cant;
                        await existe.save({ transaction: t })
                    } else {
                        detail.description = product.name + ' SKU '+product.sku;
                        detail.product = product.id;
                        detail.image = product.raw_image_name;
                    }

                } else {
                    detail.description = data.description;

                    let image_name = null;
                    if (data.image.length > 1) {
                        image_name = 'sd_temp_' + Helper.generateNameForUploadedFile() + '.jpg';
                        let location = path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images', image_name);
                        let image_data = data.image.slice(23);
                        fs.writeFile(location, image_data, 'base64', (err) => { if (err) { console.log(err) } });
                    }
                    detail.image = image_name;
                }

                //buscar ah ver si existe un detalle anterior
                detail = existe !== null ? existe : await SaleDetail.create(detail, { transaction: t });

                if (data.case == 'inventory') {
                    //buscar los stock e indexarlos
                    let tmp = await sequelize.query('SELECT * FROM `inventory_product_stock` WHERE product = :id and cant > reserved;', {
                        replacements: { id: data.product, },
                        type: QueryTypes.SELECT,
                        model: Stock,
                    });

                    var stocks = [],
                        stock = null;
                    if (tmp.length > 0) {
                        tmp.forEach(element => {
                            if (element.sucursal == sale.sucursal) {
                                stock = element;
                            } else {
                                stocks.push(element);
                            }
                        });
                    } else {
                        throw 'Existencias no econtradas';
                        console.log('RollBack por falta de stocks')
                        return { status: 'errorMessage', message: 'Existencias no econtradas' };
                    }


                    var faltante = data.cant;
                    //buscar el stock de la sucursal de la venta
                    if (stock != null) {

                        let disponible = stock.cant - stock.reserved;
                        if (disponible > faltante) {
                            stock.reserved += faltante;
                            await stock.save({ transaction: t });


                            //buscar una reserva que coincida con el producto, sucursal e id del detalle
                            let reserve = await StockReserve.findOne({
                                where: {
                                    [Op.and]: {
                                        type: 'sale',
                                        saleId: detail.id,
                                        product: stock.product,
                                        sucursal: stock.sucursal,
                                    }
                                }
                            });

                            if (reserve !== null) {
                                reserve.cant += faltante;
                                await reserve.save({ transaction: t });
                            } else {
                                //Si no existe, crearlo
                                reserve = await StockReserve.create({
                                    cant: faltante,
                                    createdBy: session.shortName,
                                    concept: 'reserva por venta',
                                    type: 'sale',
                                    saleId: detail.id,
                                    product: stock.product,
                                    sucursal: stock.sucursal,
                                }, { transaction: t });
                            }

                            faltante = 0;
                        } else {
                            stock.reserved += disponible;
                            await stock.save({ transaction: t });

                            //registrar la reserva
                            //buscar una reserva que coincida con el producto, sucursal e id del detalle
                            let reserve = await StockReserve.findOne({
                                where: {
                                    [Op.and]: {
                                        type: 'sale',
                                        saleId: detail.id,
                                        product: stock.product,
                                        sucursal: stock.sucursal,
                                    }
                                }
                            });

                            if (reserve !== null) {
                                reserve.cant += disponible;
                                await reserve.save({ transaction: t });
                            } else {
                                reserve = await StockReserve.create({
                                    cant: disponible,
                                    createdBy: session.shortName,
                                    concept: 'reserva por venta',
                                    type: 'sale',
                                    saleId: detail.id,
                                    product: stock.product,
                                    sucursal: stock.sucursal,
                                }, { transaction: t });
                            }
                            faltante -= disponible;
                        }
                    }

                    if (faltante > 0 && false) {
                        for (let index = 0; index < stocks.length; index++) {
                            const stock = stocks[index];
                            if (faltante > 0) {
                                let disponible = stock.cant - stock.reserved;
                                if (disponible > faltante) {
                                    stock.reserved += faltante;
                                    await stock.save({ transaction: t });

                                    //buscar una reserva que coincida con el producto, sucursal e id del detalle
                                    let reserve = await StockReserve.findOne({
                                        where: {
                                            [Op.and]: {
                                                type: 'sale',
                                                saleId: detail.id,
                                                product: stock.product,
                                                sucursal: stock.sucursal,
                                            }
                                        }
                                    });

                                    if (reserve !== null) {
                                        reserve.cant += faltante;
                                        await reserve.save({ transaction: t });
                                    } else {
                                        //registrar la reserva
                                        reserve = await StockReserve.create({
                                            cant: faltante,
                                            createdBy: session.shortName,
                                            concept: 'reserva por venta',
                                            type: 'sale',
                                            saleId: detail.id,
                                        }, { transaction: t });
                                    }
                                    faltante = 0;
                                } else {
                                    stock.reserved += disponible;
                                    await stock.save({ transaction: t });

                                    //buscar una reserva que coincida con el producto, sucursal e id del detalle
                                    let reserve = await StockReserve.findOne({
                                        where: {
                                            [Op.and]: {
                                                type: 'sale',
                                                saleId: detail.id,
                                                product: stock.product,
                                                sucursal: stock.sucursal,
                                            }
                                        }
                                    });

                                    if (reserve !== null) {
                                        reserve.cant += disponible;
                                        await reserve.save({ transaction: t });
                                    } else {
                                        reserve = await StockReserve.create({
                                            cant: disponible,
                                            createdBy: session.shortName,
                                            concept: 'reserva por venta',
                                            type: 'sale',
                                            saleId: detail.id,
                                        }, { transaction: t });
                                    }
                                    faltante -= disponible;
                                }
                            }
                        }
                    }

                    detail.reserved += data.cant - faltante;
                    await detail.save({ transaction: t });

                    product.reserved += data.cant - faltante;
                    await product.save({ transaction: t });
                }
                return { status: 'success', message: 'Guardado', data: { detail, balance: sale.balance } };
            });

        } catch (error) {
            console.error(error);
            return { status: 'errorMessage', message: 'Error Interno', data: error.message };
        }

    },

    socket_delete_detail: async (data) => {
        //obtener el detalle
        let detail = await SaleDetail.findByPk(data.detail_id);

        if (detail) {
            let sale = await Sale.findByPk(detail.sale).catch(err => next(err));
            if (sale) {
                try {
                    let count = await SaleDetail.count({ where: { sale: sale.id } }) - 1;

                    return await sequelize.transaction(async (t) => {

                        let old_amount = Number.parseInt(detail.cant) * Number.parseFloat(detail.price);

                        data.price = data.price !== undefined ? Number.parseFloat(data.price) : 0;
                        data.cant = Number.parseInt(data.cant > detail.cant ? detail.cant : data.cant);

                        if (detail.product == null || detail.reserved == 0) {
                            if (data.cant == detail.cant) {
                                //actualizar el monto de la venta
                                sale.balance = Number.parseFloat(sale.balance) - old_amount;
                                //detruir el detalle
                                let location = path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images', detail.img);
                                await detail.destroy({ transaction: t });
                                detail = null;
                                //eliminar la imagen temporal
                                fs.unlink(location, (err) => { if (err) { console.log(err); } else { console.log('image deleted'); } });
                            } else {
                                // reducir el detalle
                                detail.cant -= data.cant;
                                await detail.save();
                                sale.balance = Number.parseFloat(sale.balance) - old_amount + (Number.parseInt(detail.cant) * Number.parseFloat(detail.price));
                            }
                        } else {
                            //buscar el producto

                            let product = await Product.findByPk(detail.product);

                            //buscar las reservas que esten relacionadas con el stock del producto
                            let reserves = await StockReserve.findAll({
                                where: {
                                    [Op.and]: {
                                        saleId: detail.id,
                                        product: detail.product
                                    }
                                },
                                order: [['id', 'DESC']]
                                //por la creacion se tiene como prioridad la sucursal del empleado que registra, para la eliminacion se tendra como prioridad las otras sucursales
                            });
                            //buscar los stock que esten relacionados con el producto, se puede optimizar
                            let tmp = await Stock.findAll({ where: { product: detail.product }, order: [['id', 'DESC']] });
                            let stocks = {};
                            tmp.forEach(element => stocks[element.sucursal] = element);
                            //Si hay producto revisado no se puede eliminar por tanto cambiaremos el valor maximo para tomar el valor de lo que no esta revisado
                            if (detail.ready > 0) {
                                //significa que hay parte ya revisada, la cual no se puede quitar asi por asi
                                let revertible = detail.cant - detail.ready;
                                if (data.cant > revertible) {
                                    let sol = data.cant - revertible;
                                    data.cant = revertible;
                                    //realizar solicitud de reversion si se quiere hacer en automatico
                                }

                            }
                            if (data.cant > 0) {
                                //si la cantidad es igual a la cantidad del detalle vamos a eliminarlo
                                if (data.cant == detail.cant) {
                                    //buscar las reservas y destruirlas
                                    for (let index = 0; index < reserves.length; index++) {
                                        let reserve = reserves[index];
                                        let stock = stocks[reserve.sucursal];

                                        stock.reserved -= reserve.cant;
                                        await stock.save({ transaction: t });
                                        await reserve.destroy({ transaction: t });
                                    }

                                    await detail.destroy({ transaction: t });
                                    detail = null;
                                    sale.balance = Number.parseFloat(sale.balance) - old_amount;
                                    product.reserved -= data.cant;
                                    await product.save({ transaction: t });
                                } else {

                                    //si no a reducirlo
                                    let faltante = data.cant;

                                    for (let index = 0; index < reserves.length; index++) {
                                        if (faltante > 0) {
                                            let reserve = reserves[index];
                                            let stock = stocks[reserve.sucursal];

                                            if (faltante > reserve.cant) {
                                                //destruir la reserva
                                                stock.reserved -= reserve.cant;
                                                await stock.save({ transaction: t });
                                                await reserve.destroy({ transaction: t });
                                            } else {
                                                //reducir la reserva
                                                reserve.cant -= faltante;
                                                stock.reserved -= faltante;
                                                await stock.save({ transaction: t });
                                                await reserve.save({ transaction: t });
                                            }
                                        }
                                    }
                                    detail.cant -= data.cant;
                                    detail.reserved -= data.cant;
                                    product.reserved -= data.cant;
                                    await product.save({ transaction: t });
                                    await detail.save({ transaction: t });
                                    sale.balance = Number.parseFloat(sale.balance) - old_amount + (Number.parseInt(detail.cant) * Number.parseFloat(detail.price));
                                }
                            }
                        }


                        let _sale_id = sale.id;

                        if (count < 1 && detail == null) {
                            await sale.destroy({ transaction: t });
                            sale = null;
                        } else {
                            sale = await sale.save({ transaction: t });
                        }
                        return { status: 'success', message: 'Guardado', detail, balance: sale !== null ? sale.balance : null, sale_id: _sale_id };

                    });
                } catch (error) {
                    console.error(error);
                    return { status: 'errorMessage', message: 'Venta o Pedido no encontrado', data: error.message };
                }
            } else {
                return { status: 'errorMessage', message: 'Venta o Pedido no encontrado' };

            }
        } else {
            return { status: 'errorMessage', message: 'Detalle no encontrado' };
        }
    },

    socket_save_sale_in_room: async (data, session) => {
        // console.log(session)

        data.sucursal = session.employee.sucursal;
        if (data.dt.length < 1) {
            return { status: 'error', message: 'Agregue los productos a la venta' }
        } else {
            let client = await Client.findByPk(data.client);
            if (client == null) {
                return { status: 'error', message: 'Client not Found' }
            }

            var sucursal = await Sucursal.findByPk(session.employee.sucursal);

            //verificar los datos de facturacion
            //buscar la serie
            let serie = await InvoiceSeries.findByPk(data.invoice_serie);
            if (serie == null) {
                return { status: 'error', message: 'Seleccione el tipo de documento' }
            }

            //verificar si el numero del documento esta dentro del rango de la serie
            if (serie.init > data.invoice_number || data.invoice_number > serie.end) {
                return { status: 'error', message: `Este numero de Documento esta fuera del rango registrado, coloque un numero entre ${serie.init} y ${serie.end}` }
            }


            //buscar una venta que tenga el mismo numero de factura
            let existe = await Sale.count({
                where: {
                    invoce_serie: data.invoice_serie,
                    invoice_number: data.invoice_number,
                }
            });

            if (existe > 0) {
                return { status: 'error', message: 'Este numero de Documento ya esta registrado con la serie Seleccionada' }
            }

            //verificar los datos dependiendo del tipo de documento
            let update_client = false;

            if (serie.type == 'ccf') {
                if (data.invoice_data.direction.length < 5) {
                    return { status: 'error', message: 'Coloque la direccion para el Credito Fiscal' }
                } else if (data.invoice_data.nrc.length < 3) {
                    return { status: 'error', message: 'Coloque el Numero de Registro para el Credito Fiscal' }
                }




                //verificar si los datos del cliente deben ser actualizados

                if (client.NRC == null || client.NRC == "") {
                    client.NRC = data.invoice_data.nrc;
                    update_client = true;
                }
            }

            

            try {
                return await sequelize.transaction(async (t) => {
                    let sale = await Sale.create({
                        client: client.id,
                        seller: session.employee.id,
                        sucursal: session.employee.sucursal,
                        credit_conditions: 0,
                        _status: 'collected',
                        type: client.type,
                        balance: 0.00,
                        delivery_type: 'local',
                        delivery_amount: 0.00,
                        invoce_serie: serie.id,
                        invoice_type: serie.type,
                        invoice_number: data.invoice_number,
                        invoice_data: data.invoice_data,
                        invoice_resume : data.invoice_resume.length > 0 ?  data.invoice_resume : null,
                        invoice_retention : data.invoice_retention == true,
                        invoice_isr : data.invoice_isr == true,
                    }, { transaction: t });

        

                    serie.used++;
                    await serie.save({ transaction: t });


                    let balance = 0.00,
                        sale_cost = 0.00,
                        ids = [],
                        products = {},
                        stocks = {},
                        _details = [];
                    //recorrer los detalles de y obtener los ID de los productos
                    data.dt.forEach(detail => ids.push(detail.product));

                    //buscar los productos
                    let tmp = await Product.findAll({
                        where: {
                            id: { [Op.in]: ids }
                        }
                    });

                    tmp.forEach(prod => products[prod.id] = prod);

                    //buscar los stock
                    tmp = await Stock.findAll({
                        where: {
                            product: { [Op.in]: ids },
                            sucursal: sucursal.id
                        }
                    });

                    tmp.forEach(prod => stocks[prod.product] = prod);

                    //recorrer los detalles

                    var len = data.dt.length;
                    var concept = `Operación en sala de ventas, cliente ${client.name}`;

                    for (let index = 0; index < len; index++) {
                        let dt = data.dt[index],
                            product = products[dt.product],
                            stock = stocks[dt.product];

                        if (product == undefined || stock == undefined) {
                            throw "Product or Stock not Found";
                        }

                        let max = stock.cant - stock.reserved;

                        if (dt.cant > max) {
                            dt.cant = max;
                        }

                        let detail = {
                            sale: sale.id,
                            product: dt.product,
                            price: dt.price,
                            description: product.name + ' SKU ' + product.sku,
                            image: product.raw_image_name,
                            _order: index + 1,
                            cant: dt.cant,
                            ready: dt.cant,
                            delivered: dt.cant,
                            reserved: dt.cant,
                            product_cost: product.cost,
                        };

                        detail = await SaleDetail.create(detail, { transaction: t });
                        _details.push(detail);
                        balance += Number.parseFloat(dt.cant * dt.price);
                        sale_cost += Number.parseFloat(dt.cant * product.cost);


                        //generar el movimiento de salida
                        let movement = await Movement.create({
                            product: stock.product,
                            sucursal: stock.sucursal,
                            cant: dt.cant,
                            last_sucursal_stock: stock.cant,
                            last_product_stock: product.stock,
                            cost: product.cost,
                            last_cost: product.cost,
                            sale_detail: detail.id,
                            concept: concept,
                            in: false,
                        }, { transaction: t });

                        //Actualizar el producto descontando la cantidad
                        product.stock -= dt.cant;
                        await product.save({ transaction: t });

                        stock.cant -= dt.cant;
                        await stock.save({ transaction: t });

                    }
                    //ver los tipos de pago y registrarlos
                    // payments = {
                    //     money: 0.00,
                    //     credit_card: {
                    //        amount: 0.00,
                    //        details: [],
                    //     },
                    //     transfer: {
                    //        amount: 0.00,
                    //        details: [],
                    //     }
                    //  };

                    let payments_ids = [];


                    if (data.payment.money > 0) {
                        //generar el Ingreso a la caja Chica
                        let _move = await PettyCashMoves.create({
                            amount: data.payment.money,
                            last_amount: sucursal.balance,
                            concept: `Ingreso por Venta en Sala, cliente ${client.name} venta ID: ${sale.id}`,
                            petty_cash: sucursal.id,
                            type: 'payment',
                            isin: true,
                            createdBy: session.name,
                            asigned_to: client.name,
                            _number: 0,
                        }, { transaction: t });

                        let id = await SalePayment.create({
                            client: client.id,
                            sales: [{ 'id': sale.id, amount: data.payment.money },],
                            type: 'money',
                            amount: data.payment.money,
                            asigned_amount: data.payment.money,
                        }, { transaction: t });

                        payments_ids.push({ id: id.id, amount: data.payment.money })

                        sucursal.balance += Number.parseFloat(data.payment.money);
                        await sucursal.save({ transaction: t });

                    }


                    //token
                    if (data.payment.transfer.amount > 0) {
                        //recorrer los detalles y realizar los registros
                        let len = data.payment.transfer.details.length;
                        for (let index = 0; index < len; index++) {
                            const element = data.payment.transfer.details[index];
                            let id = await SalePayment.create({
                                client: client.id,
                                sales: [{ 'id': sale.id, amount: element.amount },],
                                type: 'transfer',
                                amount: element.amount,
                                asigned_amount: element.amount,
                                bank: element.bank,
                                reference: element.reference
                            }, { transaction: t });


                            payments_ids.push({ id: id.id, amount: element.amount });

                        }
                    }


                    if (data.payment.credit_card.amount > 0) {
                        //recorrer los detalles y realizar los registros

                        let len = data.payment.credit_card.details.length;
                        for (let index = 0; index < len; index++) {
                            const element = data.payment.credit_card.details[index];
                            let id = await SalePayment.create({
                                client: client.id,
                                sales: [{ 'id': sale.id, amount: element.amount },],
                                type: 'credit_card',
                                amount: element.amount,
                                asigned_amount: element.amount,
                                bank: element.bank,
                                reference: element.reference
                            }, { transaction: t });


                            payments_ids.push({ id: id.id, amount: element.amount });

                        }

                    }

                    sale.balance = balance;
                    sale.collected = balance;
                    sale.cost = sale_cost;
                    sale.payments = payments_ids;

                    console.log(data.invoice_data)
                    // let __data = (sale.invoice_data)
                    // console.log(__data)
                    // __data['invoice_date'] = sale.createdAt;
                    // console.log(__data, sale.createdAt)
                    // sale.invoice_data = __data;
                    await sale.save({ transaction: t });

                    if (update_client == true) {
                        if (client.sucursal) {

                        }

                        await client.save({ transaction: t });
                    }
                    return { status: 'success', message: 'Guardado', sale: sale.id }
                });
            } catch (error) {
                console.error(error);
                return { status: 'error', message: error.message }
            }
        }
    },






};

module.exports = SaleController;