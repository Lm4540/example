const Client = require("../../CRM/Models/Client");
const Sale = require("../../CRM/Models/Sale");
const SaleDetail = require('../../CRM/Models/SaleDetail');
const Product = require('../../Inventory/Models/Product');

const Employee = require('../../HRM/Models/Employee');
const { Op, QueryTypes } = require("sequelize");
const Helper = require('../../System/Helpers');
const sequelize = require('../../DataBase/DataBase');
const StockReserve = require("../../Inventory/Models/StockReserve");


const SalesStatusController = {
    get_data: async (session) => {
        //obtener la sucursal del usuario
        console.log(session)

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
            "SELECT * FROM `crm_client` WHERE id in (SELECT client FROM `crm_sale` WHERE sucursal = "+ _sucursal_id +" and _status in('closed','process','prepared', 'transport', 'revoking', 'delivery_failed'))",
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
                    {sucursal: _sucursal_id}
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
            "SELECT * FROM `crm_sale_detail` WHERE sale in(SELECT id FROM `crm_sale` WHERE sucursal = "+ _sucursal_id +" and _status = 'closed')",
            { type: QueryTypes.SELECT }
        );

        totals.reservas_details = tmp.length;
        tmp.forEach(detail => {
            detail.image = detail.image !== null ? (detail.image.includes('http') ? detail.image : `/upload/images/${detail.image}`) : '/upload/images/image-not-found.png';
            reservas[detail.sale].details.push(detail);
        });

        //buscar las ventas que tengan detalles de mayor que preparar
        tmp = await sequelize.query(
            "SELECT * FROM `crm_sale` WHERE sucursal = "+ _sucursal_id +" and _status = 'process' and id in (SELECT sale FROM `crm_sale_detail` WHERE cant > ready)",
            { type: QueryTypes.SELECT }
        );

        totals.mayor = tmp.length;

        tmp.forEach(sale => {
            mayor[sale.id] = {
                sale: sale,
                details: [],
                client: clients[sale.client]
            }
        });

        //buscar las ventas que haya que preparar el paquete y las que ya se hayan preparado y no sean mas viejas que un dia
        tmp = await sequelize.query(
            "SELECT * FROM `crm_sale_detail` WHERE cant > ready and sale in(SELECT id FROM `crm_sale` WHERE sucursal = "+ _sucursal_id +" and _status = 'process')",
            { type: QueryTypes.SELECT }
        );
        totals.mayor_details = tmp.length;

        tmp.forEach(detail => {
            // detail.image = (detail.image.includes('http') ? detail.image : `/upload/images/${detail.image}`);
            detail.image = detail.image !== null ? (detail.image.includes('http') ? detail.image : `/upload/images/${detail.image}`) : '/upload/images/image-not-found.png';
            mayor[detail.sale].details.push(detail);
        });



        //buscar los paquetes listos para ser entregados
        tmp = await Sale.findAll({
            where: {
                [Op.and]: [
                    { _status: 'prepared' },
                    {sucursal : _sucursal_id}
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
                    {sucursal: _sucursal_id}
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
                    {sucursal: _sucursal_id}
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
        if (sale) {
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
        }
        return { status: 'errorMessage', message: 'Venta o Pedido no encontrado' };
    },


    //funciones para los detalles de Mayor

    mayor_detail_revised: async (data, session) => {
        let sale = await Sale.findByPk(data.sale);
        if (sale == null) {
            return { status: 'errorMessage', message: 'Venta o Pedido no encontrado' };
        }

        console.log(data)

        let details = await SaleDetail.findAll({
            where: {
                id: {
                    [Op.in]: data.details,
                }
            }
        });

        console.log(details);

        try {
            return await sequelize.transaction(async (t) => {
                for (let index = 0; index < details.length; index++) {
                    let dt = details[index];

                    dt.ready = dt.cant;
                    console.log(dt.history);
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
        sale = await Sale.findByPk(sale);
        if (sale == null) {
            return { status: 'errorMessage', message: 'Venta o Pedido no encontrado' };
        }
        
        //buscar los detalles y darles salida
        let details = await SaleDetail.findAll({where: {sale: sale.id}});

        try {
            return await sequelize.transaction(async (t) => {

                sale._status = 'delivered';
                sale.delivered_by = session.shortName;
                await sale.save({transaction: t});

                //buscar las reservas y eliminarlas
                let reserves = {};
                let tmp = StockReserve.findAll({
                    where: {
                        saleId: {
                            [Op.in]: sequelize.literal(`(SELECT id FROM crm_sale_detail WHERE sale = ${sale.id})`)
                        }
                    }
                });
                tmp.forEach(e => reserves[e.saleId] = e);



                return { status: 'success', message: 'Guardado', data: sale };
            });
        } catch (error) {
            console.error(error);
            return { status: 'errorMessage', message: 'Venta o Pedido no encontrado', data: error.message };
        }



    },

    pakage_trasnport: async (sale, session) => {
        sale = await Sale.findByPk(sale);
        if (sale == null) {
            return { status: 'errorMessage', message: 'Venta o Pedido no encontrado' };
        }

        try {
            return await sequelize.transaction(async (t) => {
                sale._status = "transport";

                return { status: 'success', message: 'Guardado', data: sale };
            });
        } catch (error) {
            console.error(error);
            return { status: 'errorMessage', message: 'Venta o Pedido no encontrado', data: error.message };
        }



    },
}

module.exports = SalesStatusController;