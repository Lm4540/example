const Client = require("../../CRM/Models/Client");
const Sale = require("../../CRM/Models/Sale");
const SaleDetail = require('../../CRM/Models/SaleDetail');
const Product = require('../../Inventory/Models/Product');

const Employee = require('../../HRM/Models/Employee');
const { Op, QueryTypes } = require("sequelize");
const Helper = require('../../System/Helpers');
const sequelize = require('../../DataBase/DataBase');
const StockReserve = require("../../Inventory/Models/StockReserve");
const Stock = require("../../Inventory/Models/Stock");
const Movement = require("../../Inventory/Models/Movement");


const SalesStatusController = {



    get_data: async (session) => {
        //obtener la sucursal del usuario

        let _sucursal_id = session.employee.sucursal;
        var tmp = await Employee.findAll({ where: { isSeller: 1 }, attributes: ['id', 'name'] }),
            reservas = {},
            mayor = {},
            entregas = {},
            mayor_resolved = {},
            reservas_resolved = {},
            sellers = {},
            clients = {},
            providers = {},
            prepared = {},
            transport = {},
            delivery_failed = {},
            totals = {};

        tmp.forEach(seller => { sellers[seller.id] = seller.name; });

        //buscar los clientes
        tmp = await sequelize.query(
            "SELECT * FROM `crm_client` WHERE id in (SELECT client FROM `crm_sale` WHERE sucursal = " + _sucursal_id + " and _status in('closed','process','prepared', 'to_resend','transport', 'revoking', 'delivery_failed'))",
            { type: QueryTypes.SELECT }
        );
        tmp.forEach(client => { clients[client.id] = client.name });

        tmp = await sequelize.query(
            "SELECT * FROM `inventory_provider` WHERE type = 'transport'",
            { type: QueryTypes.SELECT }
        );
        tmp.forEach(prov => { providers[prov.id] = prov.name });

        tmp = await Sale.findAll({
            where: {
                [Op.and]: [
                    { _status: 'closed' },
                    { sucursal: _sucursal_id }
                ],
            },
            order: [['id', 'ASC']],
        });

        totals.reservas = tmp.length;

        tmp.forEach(sale => {
            reservas[sale.id] = {
                sale: sale,
                details: [],
                client: clients[sale.client]
            }
        });

        //buscar las ventas que haya que preparar el paquete y las que ya se hayan preparado y no sean mas viejas que un dia
        tmp = await sequelize.query(
            "SELECT * FROM `crm_sale_detail` WHERE sale in(SELECT id FROM `crm_sale` WHERE sucursal = " + _sucursal_id + " and _status = 'closed')",
            { type: QueryTypes.SELECT }
        );

        totals.reservas_details = tmp.length;
        tmp.forEach(detail => {
            detail.image = detail.image !== null ? (detail.image.includes('http') ? detail.image : `/upload/images/${detail.image}`) : '/upload/images/image-not-found.png';
            reservas[detail.sale].details.push(detail);
        });

        //buscar las ventas que tengan detalles de mayor que preparar
        tmp = await sequelize.query(
            "SELECT * FROM `crm_sale` WHERE sucursal = " + _sucursal_id + " and _status = 'process' and id in (SELECT sale FROM `crm_sale_detail` WHERE cant > ready)",
            { type: QueryTypes.SELECT }
        );

        totals.mayor = tmp.length;

        tmp.forEach(sale => {
            mayor[sale.id] = {
                sale: sale,
                details: [],
                client: clients[sale.client],
                open: false,
            }
        });

        //bloque nuevo

        tmp = await sequelize.query(
            "SELECT * FROM `crm_sale_detail` WHERE sale in(SELECT id FROM `crm_sale` WHERE sucursal = " + _sucursal_id + " and _status = 'process')",
            { type: QueryTypes.SELECT }
        );
        totals.mayor_details = tmp.length;
        let sum_mayor_details = 0;
        tmp.forEach(detail => {


            // sum_mayor_details += (detail.reserved - detail.ready);
            // detail.image = detail.image !== null ? (detail.image.includes('http') ? detail.image : `/upload/images/${detail.image}`) : '/upload/images/image-not-found.png';
            // mayor[detail.sale].details.push(detail);
            // if (mayor[detail.sale].open == false) {
            //     mayor[detail.sale].open = (detail.ready > 0);
            // }

            
            if (detail.reserved > detail.ready) {
                sum_mayor_details += (detail.reserved - detail.ready);
                detail.image = detail.image !== null ? (detail.image.includes('http') ? detail.image : `/upload/images/${detail.image}`) : '/upload/images/image-not-found.png';
                mayor[detail.sale].details.push(detail);
                if (mayor[detail.sale].open == false) {
                    mayor[detail.sale].open = (detail.ready > 0);
                }

            } else {
                // totals.mayor_details -= 1;
                if (mayor[detail.sale] !== undefined && detail.reserved > 0) {
                    mayor[detail.sale].open = true;
                }
            }
            // detail.image = (detail.image.includes('http') ? detail.image : `/upload/images/${detail.image}`);
        });

        totals.mayor_details = sum_mayor_details;


        //buscar los paquetes listos para ser entregados
        tmp = await Sale.findAll({
            where: {
                [Op.and]: [
                    { _status: { [Op.in]: ['prepared', 'to_resend'] } },
                    { sucursal: _sucursal_id }
                ],
            },
            order: [['id', 'ASC']],
        });
        //token
        totals.prepared = tmp.length;

        tmp.forEach(sale => {
            prepared[sale.id] = {
                sale: sale,
                client: clients[sale.client]
            }
        });




        //buscar los paquetes siendo transportados
        tmp = await Sale.findAll({
            where: {
                [Op.and]: [
                    { _status: 'transport' },
                    { sucursal: _sucursal_id }
                ],
            },
            order: [['id', 'ASC']],
        });
        //token
        totals.transport = tmp.length;

        tmp.forEach(sale => {
            transport[sale.id] = {
                sale: sale,
                client: clients[sale.client]
            }
        });

        //buscar los paquetes fallo de entrega
        tmp = await Sale.findAll({
            where: {
                [Op.and]: [
                    { _status: 'delivery_failed' },
                    { sucursal: _sucursal_id }
                ],
            },
            order: [['id', 'ASC']],
        });
        //token
        totals.delivery_failed = tmp.length;

        tmp.forEach(sale => {
            delivery_failed[sale.id] = {
                sale: sale,
                client: clients[sale.client]
            }
        });

        return {
            reservas, mayor, entregas, sellers, clients, mayor_resolved, reservas_resolved, totals, providers, prepared, transport, delivery_failed
        };
    },

    package_ready: async (sale_id, session) => {
        let sale = await Sale.findByPk(sale_id);
        if (sale && sale._status == "closed") {
            try {
                return await sequelize.transaction(async (t) => {
                    sale.package_by = session.name;
                    sale._status = 'prepared';
                    await sale.save({ transaction: t });
                    await sequelize.query(
                        'update `crm_sale_detail` set ready = cant WHERE sale = ?',
                        {
                            replacements: [sale.id],
                            type: QueryTypes.UPDATE,
                            transaction: t
                        }
                    );

                    return { status: 'success', message: 'Guardado', sale };
                });
            } catch (error) {
                console.error(error);
                return { status: 'errorMessage', message: 'Venta o Pedido no encontrado', data: error.message };
            }
        } else {
            return { status: 'errorMessage', message: 'La venta no fue encontrada :P' };
        }
        return { status: 'errorMessage', message: 'Venta o Pedido no encontrado' };
    },

    //funciones para los detalles de Mayor
    mayor_detail_revised: async (data, session) => {

        let sale = await Sale.findByPk(data.sale);
        if (sale == null) {
            return { status: 'errorMessage', message: 'Venta o Pedido no encontrado' };
        }
        let details = await SaleDetail.findAll({
            where: {
                id: {
                    [Op.in]: data.details,
                }
            }
        });
        try {
            return await sequelize.transaction(async (t) => {
                for (let index = 0; index < details.length; index++) {
                    let dt = details[index];
                    dt.ready = dt.reserved;
                    await dt.save({ transaction: t });

                }
                return { status: 'success', message: 'Guardado', data };
            });
        } catch (error) {
            console.error(error);
            return { status: 'errorMessage', message: 'Venta o Pedido no encontrado', data: error.message };
        }



    },

    pakage_delivered: async (sale, session) => {

        //return { status: 'errorMessage', message: 'Funcion en revision' };
        sale = await Sale.findByPk(sale);
        if (sale == null || sale.delivered_by !== null) {
            return { status: 'errorMessage', message: 'Sale not found or sale was already delivered' };
        }

        //buscar los detalles y darles salida
        let details = await SaleDetail.findAll({ where: { sale: sale.id } });
        let client = await Client.findByPk(sale.client);
        try {
            return await sequelize.transaction(async (t) => {

                let sale_cost = 0.00;

                var concept = `Egreso por venta id: ${sale.id}, cliente ${client.name}`;
                let len = details.length;

                var stock_to_dicount = {};
                var product_to_discount = {};

                for (let index = 0; index < len; index++) {
                    const dt = details[index];
                    //buscar las reservas
                    let tmp = await StockReserve.findAll({ where: { saleId: dt.id, } }, { transaction: t });
                    let product_cost = 0.00;
                    //recorrer las reservas e ir sacandolas
                    for (let a = 0; a < tmp.length; a++) {
                        let reserve = tmp[a];
                        //buscar el stock
                        let stock = await Stock.findOne({
                            where: {
                                sucursal: reserve.sucursal,
                                product: reserve.product
                            }
                        });
                        if (stock) {
                            //buscar el producto
                            let product = await Product.findByPk(reserve.product);
                            if (product) {
                                //registrar el movimiento de salida
                                let movement = await Movement.create({
                                    product: stock.product,
                                    sucursal: stock.sucursal,
                                    cant: reserve.cant,
                                    last_sucursal_stock: stock_to_dicount[stock.id] != undefined ? (stock.cant - stock_to_dicount[stock.id]) : stock.cant,
                                    last_product_stock: product_to_discount[product.id] != undefined ? (product.stock - product_to_discount[product.id]) : product.stock,
                                    cost: product.cost,
                                    last_cost: product.cost,
                                    sale_detail: dt.id,
                                    concept: concept,
                                    in: false,
                                }, { transaction: t });


                                stock_to_dicount[stock.id] = stock_to_dicount[stock.id] !== undefined ? stock_to_dicount[stock.id] + reserve.cant : reserve.cant;
                                product_to_discount[product.id] = product_to_discount[product.id] !== undefined ? product_to_discount[product.id] + reserve.cant : reserve.cant;

                                await reserve.destroy({ transaction: t })

                                //actualizar el detalle
                                sale_cost += Helper.fix_number(product.cost * reserve.cant);
                                product_cost += Helper.fix_number(product.cost * reserve.cant);
                                dt.delivered += reserve.cant;
                                dt.product_cost = product.cost;
                            } else {
                                return { status: 'errorMessage', message: 'producto id ' + reserve.product + ' no encontrado' };
                            }
                            //TOEKN REVISAR ESTA MIERDA
                        } else {
                            return { status: 'errorMessage', message: 'Stock not found for product id ' + reserve.product + ' and sucursal ' + reserve.sucursal + '!' };
                        }

                    }
                    // dt.product_cost = (product_cost / dt.delivered);
                    await dt.save({ transaction: t });
                }

                let keys = Object.keys(stock_to_dicount);

                for (let index = 0; index < keys.length; index++) {
                    let _stock_id = keys[index];
                    await sequelize.query(
                        'update `inventory_product_stock` set cant = cant - :_cant, reserved = reserved - :_reserved  WHERE id = :_stock_id',
                        {
                            replacements: {
                                _cant: stock_to_dicount[_stock_id],
                                _reserved: stock_to_dicount[_stock_id],
                                _stock_id: _stock_id
                            },
                            type: QueryTypes.UPDATE,
                            transaction: t
                        }
                    );

                }


                keys = Object.keys(product_to_discount);

                for (let index = 0; index < keys.length; index++) {
                    let _stock_id = keys[index];
                    await sequelize.query(
                        'update `inventory_product` set stock = stock - :_cant, reserved = reserved - :_reserved  WHERE id = :_stock_id',
                        {
                            replacements: {
                                _cant: product_to_discount[_stock_id],
                                _reserved: product_to_discount[_stock_id],
                                _stock_id: _stock_id
                            },
                            type: QueryTypes.UPDATE,
                            transaction: t
                        }
                    );

                }

                sale._status = 'delivered';
                sale.delivered_by = session.shortName;
                sale.cost = sale_cost;
                await sale.save({ transaction: t });
                return { status: 'success', message: 'Guardado', data: sale };
            });
        } catch (error) {
            console.error(error);
            return { status: 'errorMessage', message: 'Venta o Pedido no encontrado', data: error.message };
        }



    },

    pakage_delivered_old: async (sale, session) => {

        //return { status: 'errorMessage', message: 'Funcion en revision' };
        sale = await Sale.findByPk(sale);
        if (sale == null) {
            return { status: 'errorMessage', message: 'Venta o Pedido no encontrado' };
        }

        //buscar los detalles y darles salida
        let details = await SaleDetail.findAll({ where: { sale: sale.id } });
        let client = await Client.findByPk(sale.client);
        try {
            return await sequelize.transaction(async (t) => {

                let sale_cost = 0.00;

                var concept = `Egreso por venta id: ${sale.id}, cliente ${client.name}`;
                let len = details.length;

                var stock_to_dicount = {};
                var product_to_discount = {};

                for (let index = 0; index < len; index++) {
                    const dt = details[index];
                    //buscar las reservas
                    let tmp = await StockReserve.findAll({ where: { saleId: dt.id, } }, { transaction: t });
                    let product_cost = 0.00;
                    //recorrer las reservas e ir sacandolas
                    for (let a = 0; a < tmp.length; a++) {
                        let reserve = tmp[a];
                        //buscar el stock
                        let stock = await Stock.findOne({
                            where: {
                                sucursal: reserve.sucursal,
                                product: reserve.product
                            }
                        });
                        if (stock) {
                            //buscar el producto
                            let product = await Product.findByPk(reserve.product);
                            if (product) {
                                //registrar el movimiento de salida
                                let movement = await Movement.create({
                                    product: stock.product,
                                    sucursal: stock.sucursal,
                                    cant: reserve.cant,
                                    last_sucursal_stock: stock.cant,
                                    last_product_stock: product.stock,
                                    cost: product.cost,
                                    last_cost: product.cost,
                                    sale_detail: dt.id,
                                    concept: concept,
                                    in: false,
                                }, { transaction: t });

                                stock.reserved -= reserve.cant;
                                stock.cant -= reserve.cant;
                                await stock.save({ transaction: t });



                                //agregar el item a 

                                // await sequelize.query(
                                //     'update `inventory_product_stock` set cant = cant - :_cant, reserved = :_reserved  WHERE id = :_stock_id',
                                //     {
                                //         replacements: {
                                //             _cant: reserve.cant,
                                //             _reserved : reserve.cant,
                                //             _stock_id : stock.id
                                //         },
                                //         type: QueryTypes.UPDATE,
                                //         transaction: t
                                //     }
                                // );

                                product.reserved -= reserve.cant;
                                product.stock -= reserve.cant;
                                await product.save({ transaction: t });

                                // await sequelize.query(
                                //     'update `inventory_product` set stock = stock - :_cant, reserved = reserved - :_reserved  WHERE id = :_stock_id',
                                //     {
                                //         replacements: {
                                //             _cant: reserve.cant,
                                //             _reserved : reserve.cant,
                                //             _stock_id : product.id
                                //         },
                                //         type: QueryTypes.UPDATE,
                                //         transaction: t
                                //     }
                                // );


                                await reserve.destroy({ transaction: t })




                                //actualizar el detalle
                                sale_cost += Helper.fix_number(product.cost * reserve.cant);
                                product_cost += Helper.fix_number(product.cost * reserve.cant);
                                dt.delivered += reserve.cant;
                                dt.product_cost = product.cost;
                            } else {
                                return { status: 'errorMessage', message: 'producto id ' + reserve.product + ' no encontrado' };
                            }
                            //TOEKN REVISAR ESTA MIERDA
                        } else {
                            return { status: 'errorMessage', message: 'Stock not found for product id ' + reserve.product + ' and sucursal ' + reserve.sucursal + '!' };
                        }

                    }
                    // dt.product_cost = (product_cost / dt.delivered);
                    await dt.save({ transaction: t });
                }

                sale._status = 'delivered';
                sale.delivered_by = session.shortName;
                sale.cost = sale_cost;
                await sale.save({ transaction: t });
                return { status: 'success', message: 'Guardado', data: sale };
            });
        } catch (error) {
            console.error(error);
            return { status: 'errorMessage', message: 'Venta o Pedido no encontrado', data: error.message };
        }



    },

    package_trasnport: async (sale, session) => {
        sale = await Sale.findByPk(sale);
        if (sale == null) {
            return { status: 'errorMessage', message: 'Venta o Pedido no encontrado' };
        }

        try {

            console.log('llega aqui')
            return await sequelize.transaction(async (t) => {
                sale._status = "transport";
                await sale.save()
                return { status: 'success', message: 'Guardado', data: sale };
            });
        } catch (error) {
            console.error(error);
            return { status: 'errorMessage', message: 'Venta o Pedido no encontrado', data: error.message };
        }



    },

    package_not_delivered: async (data, session) => {
        try {

            return await sequelize.transaction(async (t) => {
                let sale = await Sale.findByPk(data.sale);
                if (sale) {

                    let details = await SaleDetail.findAll({
                        where: {
                            sale: sale.id
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

                        let _P = await Product.findByPk(detail.product);
                        _P.reserved = _P.reserved - detail.cant;
                        await _P.save({ transaction: t });

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
                            await reserve.destroy({ transaction: t });
                        }
                        //actualizar el detalle

                        detail.delivered = 0;
                        detail.reserved = 0;
                        detail.ready = 0;
                        await detail.save({ transaction: t });
                    }
                    sale._status = 'revoked';
                    sale.revoked_at = new Date();
                    sale.revoked_reason = data.reason;
                    await sale.save({ transaction: t });
                    console.log(sale.id)
                    return { status: 'success', message: 'Guardado', data: sale };
                }
                return { status: 'errorMessage', message: 'Sale not Found', data: 'Venta no encontrada' };
            });
        } catch (error) {
            console.log(error)
            return { status: 'errorMessage', message: 'Error interno', data: error.message };
        }
    },


    package_resend: async (data, session) => {
        try {

            return await sequelize.transaction(async (t) => {
                let sale = await Sale.findByPk(data.sale);
                if (sale) {

                    sale._status = 'to_resend';
                    sale.revoked_reason = data.reason;
                    sale.delivery_amount = data.delivery_amount;
                    sale.delivery_provider = data.delivery_provider;
                    sale.delivery_date = new Date(data.day + 'T06:10:10');
                    sale.delivery_time = data.time;
                    sale.delivery_type = data.delivery_type;
                    sale.delivery_direction = data.direction;
                    sale.delivery_contact = data.phone;
                    sale.delivery_instructions = data.reference;
                    await sale.save({ transaction: t });
                    return { status: 'success', message: 'Guardado', data: sale };

                }

                return { status: 'errorMessage', message: 'Sale not Found', data: 'Venta no encontrada' };
            });

        } catch (error) {
            console.log(error)
            return { status: 'errorMessage', message: 'Error interno', data: error.message };
        }
    }


}

module.exports = SalesStatusController;