const Product = require('../Models/Product');
const Sucursal = require('../Models/Sucursal');
const Stock = require('../Models/Stock');
const Movement = require('../Models/Movement');
const Recount = require('../Models/Recount');
const RecountDetail = require('../Models/RecountDetail');
const RecountArea = require('../Models/RecountArea');
const RecountAreaDetail = require('../Models/RecountAreaDetail');
const Shipment = require('../Models/Shipment');
const ShipmentDetail = require('../Models/ShipmentDetail');
const StockReserve = require('../Models/StockReserve');
const Client = require('../../CRM/Models/Client');
const Sale = require('../../CRM/Models/Sale');
const Requisition = require('../Models/Requisition');
const RequisitionDetail = require('../Models/RequisitionDetail');
const Helper = require('../../System/Helpers');
const Money = require('../../System/Money');
const sequelize = require("../../DataBase/DataBase");
const { Op, QueryTypes } = require("sequelize");
const SaleDetail = require('../../CRM/Models/SaleDetail');
const ProductClassification = require('../Models/ProductClassification');



const StockController = {

    getProductReserveList: async (req, res) => {
        let product = await Product.findByPk(req.params.id);
        let sucursal = await Sucursal.findByPk(req.session.userSession.employee.sucursal);
        if (product && sucursal) {
            console.log(sucursal)
            //buscar lso detalles de las ventas
            let _sql = `select crm_sale.id as sale_id, crm_client.id as client_id, crm_client.name as client_name, crm_sale_detail.* from crm_sale_detail INNER JOIN crm_sale on crm_sale.id = crm_sale_detail.sale INNER JOIN crm_client on crm_client.id = crm_sale.client WHERE crm_sale_detail.product = :_product and crm_sale_detail.cant > crm_sale_detail.ready and crm_sale_detail.reserved > crm_sale_detail.ready and crm_sale_detail.sale in (select id from crm_sale where crm_sale.sucursal = :_abc and crm_sale._status = "process")`;

            let details = await sequelize.query(_sql, {
                replacements: {
                    _product: product.id,
                    _abc: sucursal.id,
                },
                type: QueryTypes.SELECT
            });

            return res.render('Inventory/Stock/ReservarProductoIndividual', {
                product,
                pageTitle: product.name + " Lista de reservas",
                sucursal, details
            });

        }

        return Helper.notFound(req, res, 'Product no Found')








    },

    ProductreserveList: async (req, res) => {
        let tmp = await Product.findAll({
            where: {
                id: { [Op.in]: sequelize.literal(`(SELECT product FROM crm_sale_detail WHERE cant > ready and sale in (SELECT id FROM crm_sale WHERE sucursal = ${req.session.userSession.employee.sucursal} and  _status = 'process'))`) }
            },
            order: [['name', 'ASC']],
        });

        let products = {};
        tmp.forEach(prod => {
            products[`s_${prod.id}`] = {
                name: prod.name,
                image: prod.image,
                cant: 0,
                provider_code: prod.provider_code,
                internal_code: prod.internal_code,
                id: prod.id
            }
        })

        tmp = await sequelize.query(`SELECT * FROM crm_sale_detail WHERE cant > ready and reserved > ready and sale in (SELECT id FROM crm_sale WHERE sucursal = ${req.session.userSession.employee.sucursal} and _status = 'process')`, { type: QueryTypes.SELECT, model: SaleDetail });

        tmp.forEach(dt => {
            if (products[`s_${dt.product}`] !== undefined) {
                products[`s_${dt.product}`].cant = products[`s_${dt.product}`].cant + (dt.cant - dt.ready);
            }

            // products[dt.product].cant > 0 ? products[dt.product].cant += (dt.cant - dt.ready) : products[dt.product].cant = (dt.cant - dt.ready);
        });

        // let llaves = Object.keys(products);

        return res.render('Inventory/Stock/productReserveList', {
            pageTitle: 'Lista de productos a Buscar',
            products
        });



    },

    viewRequisitions: async (req, res) => {
        let sucursals = await Sucursal.findAll();
        let init = null, end = null;
        if (req.query.init !== undefined) {
            init = req.query.init;
            end = req.query.end;
        } else {
            let d = new Date();
            let m = d.getMonth() + 1;
            m = m > 9 ? m : '0' + m;
            let day = d.getDate();
            day = day > 9 ? day : '0' + day;

            init = `${d.getFullYear()}-${m}-01T00:00:00`;
            d.setHours(d.getHours() + 6);
            end = `${d.getFullYear()}-${m}-${day}T23:59:59`;
        }

        let open = await Requisition.findAll({
            where: {
                _status: 'open'
            },
            order: [['id', 'DESC']],
        });

        let requisitions = await Requisition.findAll({
            where: {
                createdAt: { [Op.between]: [init, end], },
                _status: 'closed'
            },
            order: [['id', 'DESC']],
        });

        let indexed_sucursals = {};
        sucursals.forEach(e => indexed_sucursals[e.id] = e.name);
        return res.render('Inventory/Requisition/Requisitions', {
            pageTitle: 'Solicitudes de Transferencia',
            sucursals, requisitions, init, end, indexed_sucursals, open
        });
    },

    viewRequisitionOLD: async (req, res) => {
        let sucursals = await Sucursal.findAll();
        let indexed_sucursals = {};
        sucursals.forEach(e => indexed_sucursals[e.id] = e.name);
        let requisition = await Requisition.findByPk(req.params.id);

        if (requisition) {


            let products = {};
            sucursals = await sequelize.query('SELECT * FROM `inventory_product` WHERE id in (select product from inventory_requisition_detail where requisition = :_requisition)order by name ASC', {
                type: QueryTypes.SELECT,
                model: Product,
                replacements: {
                    _requisition: requisition.id
                }
            });

            sucursals.forEach(prod => {
                products[prod.id] = {
                    name: prod.name,
                    image: prod.image,
                    detail: {},
                    provider_code: prod.provider_code,
                    sku: prod.internal_code,
                }
            });

            let details = await RequisitionDetail.findAll({
                where: {
                    requisition: requisition.id
                }, raw: true,
            });

            details.forEach(det => products[det.product].detail = det);

            return res.render(requisition._status == 'open' ? 'Inventory/Requisition/view' : 'Inventory/Requisition/closed', {
                pageTitle: `Solicitud de Transferencia ${requisition.id}`,
                requisition, indexed_sucursals, products
            });
        }

        return Helper.notFound(req, res, 'Requisition not Found')
    },

    viewRequisition: async (req, res) => {
        let tmp = await Sucursal.findAll();
        let indexed_sucursals = {};
        tmp.forEach(e => indexed_sucursals[e.id] = e.name);
        let requisition = await Requisition.findByPk(req.params.id);

        if (requisition) {


            let products = {};
            tmp = await sequelize.query('SELECT * FROM `inventory_product` WHERE id in (select product from inventory_requisition_detail where requisition = :_requisition)order by name ASC', {
                type: QueryTypes.SELECT,
                model: Product,
                replacements: {
                    _requisition: requisition.id
                }
            });

            tmp.forEach(prod => {
                products[prod.id] = {
                    name: prod.name,
                    image: prod.image,
                    details: [],
                    provider_code: prod.provider_code,
                    sku: prod.internal_code,
                    cant: 0
                }
            });

            let details = await RequisitionDetail.findAll({
                where: {
                    requisition: requisition.id
                }, raw: true,
            });

            details.forEach(det => {
                products[det.product].details.push(det);
                products[det.product].cant = det.cant + products[det.product].cant;
            });

            return res.render(requisition._status == 'open' ? 'Inventory/Requisition/view' : 'Inventory/Requisition/closed', {
                pageTitle: `Solicitud de Transferencia ${requisition.id}`,
                requisition, indexed_sucursals, products
            });
        }

        return Helper.notFound(req, res, 'Requisition not Found')
    },

    viewRequisition_MyProducts: async (req, res) => {
        let tmp = await Sucursal.findAll();
        let indexed_sucursals = {};
        let userid = req.session.userSession.employee.id;

        tmp.forEach(e => indexed_sucursals[e.id] = e.name);
        let requisition = await Requisition.findByPk(req.params.id);

        if (requisition && requisition._status == 'open') {


            let products = {};
            tmp = await sequelize.query('SELECT * FROM `inventory_product` WHERE id in (select product from inventory_requisition_detail where user = :_userid and requisition = :_requisition)order by name ASC', {
                type: QueryTypes.SELECT,
                model: Product,
                replacements: {
                    _requisition: requisition.id,
                    _userid: userid
                }
            });

            tmp.forEach(prod => {
                products[prod.id] = {
                    name: prod.name,
                    image: prod.image,
                    details: [],
                    provider_code: prod.provider_code,
                    sku: prod.internal_code,
                    cant: 0
                }
            });

            let details = await RequisitionDetail.findAll({
                where: {
                    requisition: requisition.id,
                    user: req.session.userSession.employee.id
                }, raw: true,
            });

            details.forEach(det => {
                products[det.product].details.push(det);
                products[det.product].cant = det.cant + products[det.product].cant;
            });

            return res.render(requisition._status == 'open' ? 'Inventory/Requisition/viewMyProducts' : 'Inventory/Requisition/closed', {
                pageTitle: `Solicitud de Transferencia ${requisition.id}`,
                requisition, indexed_sucursals, products
            });
        }

        return Helper.notFound(req, res, 'Requisition not Found or it´s closed')
    },

    updateRequisition: async (req, res) => {
        let data = req.body;
        let createdBy = req.session.userSession.shortName;
        let userid = req.session.userSession.employee.id;

        switch (data.case) {
            case 'create':
                //verificar los datos
                if (data.details.length < 1) {
                    return { status: 'error', message: 'Agregue los productos que va a trasladar' }
                } else if (data.sucursal == data.destino) {
                    return { status: 'error', message: 'La sucursal de origen y destino deben ser diferentes' }
                } else {
                    var sucursal = await Sucursal.findByPk(data.sucursal);
                    var destino = await Sucursal.findByPk(data.destino);

                    try {
                        var ids = [], products = {}, stocks = {};
                        let requisition = await Requisition.findOne({
                            where: {
                                _status: 'open',
                                destino: data.destino, origin: data.sucursal
                            }
                        });

                        //recorrer los detalles de y obtener los ID de los productos
                        data.details.forEach(detail => ids.push(detail.product));
                        //buscar los productos
                        let tmp = await Product.findAll({
                            where: { id: { [Op.in]: ids } }
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

                        var len = data.details.length;

                        if (requisition) {
                            return await sequelize.transaction(async (t) => {
                                for (let index = 0; index < len; index++) {
                                    let dt = data.details[index],
                                        product = products[dt.product],
                                        stock = stocks[dt.product];

                                    if (product == undefined || stock == undefined) {
                                        throw "Product or Stock not Found";
                                    }

                                    let max = stock.cant - stock.reserved;

                                    if (dt.cant > max) {
                                        dt.cant = max;
                                    }
                                    //redactar el cuerpo del detalle
                                    //Buscar el detalle a ver si existe
                                    let detail = await RequisitionDetail.findOne({
                                        where: {
                                            requisition: requisition.id,
                                            product: dt.product,
                                            sale_detail: { [Op.is]: null }
                                        }
                                    });


                                    if (detail) {
                                        detail.cant = Number.parseInt(detail.cant + dt.cant);
                                        await detail.save({ transaction: t });

                                        let reserve = await StockReserve.findOne({
                                            where: {
                                                product: dt.product,
                                                sucursal: stock.sucursal,
                                                orderId: detail.id,
                                            }
                                        });
                                        reserve.cant = Number.parseInt(reserve.cant + dt.cant);
                                        await reserve.save({ transaction: t });
                                    } else {
                                        detail = await RequisitionDetail.create({
                                            requisition: requisition.id,
                                            product: dt.product,
                                            cant: dt.cant,
                                            createdBy,
                                            user: userid
                                        }, { transaction: t });

                                        let reserve = await StockReserve.create({
                                            cant: dt.cant,
                                            createdBy,
                                            concept: 'Reserva por Solicitudes de Trasalado',
                                            type: 'requisition',
                                            orderId: detail.id,
                                            product: stock.product,
                                            sucursal: stock.sucursal,
                                        }, { transaction: t });
                                    }

                                    //Actualizar el producto descontando la cantidad
                                    product.reserved += Number.parseInt(dt.cant);
                                    await product.save({ transaction: t });
                                    stock.reserved += Number.parseInt(dt.cant);
                                    await stock.save({ transaction: t });

                                }

                                return res.json({ status: 'success', message: 'Detalles agregados a la solicitud en curso. ¡Redirigiendo!', data: requisition.id });
                            });
                        } else {
                            return await sequelize.transaction(async (t) => {
                                //crear el envio
                                requisition = await Requisition.create({
                                    origin: sucursal.id,
                                    destino: destino.id,
                                    _status: 'open',
                                    createdBy: createdBy,
                                });


                                for (let index = 0; index < len; index++) {
                                    let dt = data.details[index],
                                        product = products[dt.product],
                                        stock = stocks[dt.product];

                                    if (product == undefined || stock == undefined) {
                                        throw "Product or Stock not Found";
                                    }

                                    let max = stock.cant - stock.reserved;

                                    if (dt.cant > max) {
                                        dt.cant = max;
                                    }
                                    //redactar el cuerpo del detalle
                                    //guardar el cuerpo del detalle
                                    let detail = await RequisitionDetail.create({
                                        requisition: requisition.id,
                                        product: dt.product,
                                        cant: dt.cant,
                                        createdBy,
                                        user: userid
                                    }, { transaction: t });

                                    reserve = await StockReserve.create({
                                        cant: dt.cant,
                                        createdBy,
                                        concept: 'Reserva por Solicitudes de Trasalado',
                                        type: 'requisition',
                                        orderId: detail.id,
                                        product: stock.product,
                                        sucursal: stock.sucursal,
                                    }, { transaction: t });

                                    //Actualizar el producto descontando la cantidad
                                    product.reserved += Number.parseInt(dt.cant);
                                    await product.save({ transaction: t });
                                    stock.reserved += Number.parseInt(dt.cant);
                                    await stock.save({ transaction: t });

                                }

                                return res.json({ status: 'success', message: 'Solicitud Creada. ¡Redirigiendo!', data: requisition.id });
                            });
                        }
                    } catch (error) {
                        console.error(error);
                        return { status: 'error', message: error.message }
                    }
                }
                //Verificar si ya existe una orden de traslado con las sucursales de origien y destino



                break;
            case 'addDetail':
                data.cant = Number.parseInt(data.cant);
                if (isNaN(data.cant) || data.cant < 1) {
                    return res.json({ status: 'errorMessage', message: 'Ingrese una cantidad valida', });
                }

                try {
                    //buscar la requisition
                    let requisition = await Requisition.findByPk(data.requisition);
                    if (requisition && requisition._status == 'open') {
                        //buscar el producto
                        //buscar el stock
                        let product = await Product.findByPk(data.product);
                        let stock = await Stock.findOne({
                            where: {
                                product: data.product,
                                sucursal: requisition.origin
                            }
                        });

                        if (product && stock) {
                            let detail = await RequisitionDetail.findOne({
                                where: {
                                    requisition: requisition.id,
                                    product: data.product,
                                    client: { [Op.is]: null },
                                    user: userid
                                }
                            });

                            return await sequelize.transaction(async (t) => {

                                if (detail) {
                                    detail.cant = Number.parseInt(detail.cant + data.cant);
                                    await detail.save({ transaction: t });

                                    let reserve = await StockReserve.findOne({
                                        where: {
                                            product: data.product,
                                            sucursal: stock.sucursal,
                                            orderId: detail.id,
                                        }
                                    });
                                    reserve.cant = Number.parseInt(reserve.cant + data.cant);
                                    await reserve.save({ transaction: t });
                                } else {
                                    detail = await RequisitionDetail.create({
                                        requisition: requisition.id,
                                        product: data.product,
                                        cant: data.cant,
                                        createdBy,
                                        user: userid
                                    }, { transaction: t });

                                    let reserve = await StockReserve.create({
                                        cant: data.cant,
                                        createdBy,
                                        concept: 'Reserva por Solicitudes de Trasalado',
                                        type: 'requisition',
                                        orderId: detail.id,
                                        product: stock.product,
                                        sucursal: stock.sucursal,
                                    }, { transaction: t });
                                }

                                //Actualizar el producto descontando la cantidad
                                product.reserved += Number.parseInt(data.cant);
                                await product.save({ transaction: t });
                                stock.reserved += Number.parseInt(data.cant);
                                await stock.save({ transaction: t });
                                return res.json({ status: 'success', message: 'Detalles agregados a la solicitud en curso. ¡Redirigiendo!', data: requisition.id });
                            });
                        }
                        return Helper.notFound(req, res, 'Product or Stock not Found');

                    }
                    return Helper.notFound(req, res, 'Requisition not Found');
                } catch (error) {
                    console.error(error);
                    return { status: 'error', message: error.message }
                }

                break;
            case 'quitDetail':


                data.cant = Number.parseInt(data.cant);
                if (isNaN(data.cant) || data.cant < 1) {
                    return res.json({ status: 'errorMessage', message: 'Ingrese una cantidad valida', });
                }

                try {
                    //buscar la requisition
                    let requisition = await Requisition.findByPk(data.requisition);
                    let detail = await RequisitionDetail.findByPk(data.detail);
                    if (detail && requisition && requisition._status == 'open') {
                        //buscar el producto

                        //buscar el stock
                        let product = await Product.findByPk(detail.product);
                        let stock = await Stock.findOne({
                            where: {
                                product: detail.product,
                                sucursal: requisition.origin
                            }
                        });

                        let cant = Number.parseInt(data.cant);
                        if (cant > detail.cant) { cant = detail.cant }




                        return await sequelize.transaction(async (t) => {
                            let reserve = await StockReserve.findOne({
                                where: {
                                    orderId: detail.id,
                                }
                            });

                            //VERIFICAR SI ES DE VENTA
                            if (detail.sale_detail !== null) {
                                let sale_detail = await SaleDetail.findByPk(detail.sale_detail);
                                if (sale_detail) {
                                    let more_details = await SaleDetail.count({
                                        where: {
                                            sale: sale_detail.sale,
                                            id: {
                                                [Op.ne]: sale_detail.id
                                            }
                                        }
                                    });

                                    console.log('\n\n', more_details, 'Esta es la cantidad de otros detalles que hay en la chingadera esta')

                                    let sale = await Sale.findByPk(sale_detail.sale);
                                    if (sale !== null) {
                                        // sale.balance = sale.balance - (detail.price * cant);

                                        sale.balance = Helper.fix_number(sale.balance - (sale_detail.price * cant))

                                        if (sale_detail.cant == cant) {
                                            await sale_detail.destroy({ transaction: t });
                                        } else {

                                            sale_detail.cant = sale_detail.cant - cant;
                                            await sale_detail.save({ transaction: t });

                                        }

                                        if (sale.balance > 0 || more_details > 0) {
                                            await sale.save({ transaction: t });
                                        } else {
                                            await sale.destroy({
                                                transaction: t
                                            });
                                        }

                                    } else {
                                        throw 'venta no encontrada';
                                    }
                                } else {
                                    throw 'Detalle no encontrado';
                                }

                            }

                            //TOKEN


                            if (cant == detail.cant) {
                                await reserve.destroy({ transaction: t });
                                await detail.destroy({ transaction: t });
                            } else {
                                reserve.cant = Number.parseInt(reserve.cant - cant);
                                await reserve.save({ transaction: t });
                                detail.cant = Number.parseInt(detail.cant - cant);
                                await detail.save({ transaction: t });
                            }

                            //Actualizar el producto descontando la cantidad
                            product.reserved -= Number.parseInt(data.cant);
                            await product.save({ transaction: t });
                            stock.reserved -= Number.parseInt(data.cant);
                            await stock.save({ transaction: t });



                            return res.json({ status: 'success', message: 'Detalles eliminados de la solicitud. ¡Redirigiendo!', data: data.requisition });
                        });

                    }
                    return Helper.notFound(req, res, 'Requisition or detail not Found');
                } catch (error) {
                    console.error(error);
                    return { status: 'error', message: error.message }
                }
                break;
            case 'commentary':
                try {
                    //buscar la requisition
                    let requisition = await Requisition.findByPk(data.requisition);
                    if (requisition && requisition._status == 'open') {
                        requisition.commentary = data.commentary;
                        await requisition.save();
                        return res.json({ status: 'success', message: '¡Actualizado!', data: requisition.id });

                    }
                    return Helper.notFound(req, res, 'Requisition not Found');
                } catch (error) {
                    console.error(error);
                    return { status: 'error', message: error.message }
                }

                break;
            default:
                break;
        }
    },

    proccessRequisition: async (req, res) => {
        let data = req.body;
        let createdBy = req.session.userSession.shortName;
        if (data.transporta.length < 3) {
            return res.json({ status: 'errorMessage', message: "Indique el nombre de la persona que transportara el producto" });
        }


        try {
            //buscar la requisition
            let requisition = await Requisition.findByPk(data.requisition);
            if (requisition && requisition._status !== "closed") {
                //buscar los detalles

                let details = await RequisitionDetail.findAll({
                    where: {
                        requisition: requisition.id,
                    }
                });

                if (details.length < 1) {
                    return res.json({ status: 'errorMessage', message: "Agregue detalles al cuerpo de la Solicitud" });
                }

                //buscar los productos
                let tmp = await sequelize.query('SELECT * FROM `inventory_product` WHERE id in (select product from inventory_requisition_detail where requisition = :_requisition)', {
                    type: QueryTypes.SELECT,
                    model: Product,
                    replacements: {
                        _requisition: requisition.id
                    }
                });

                let products = {};
                tmp.forEach(e => products[e.id] = e);

                //buscar los stock
                tmp = await sequelize.query('SELECT * FROM `inventory_product_stock` WHERE sucursal = :sucursal and product in (select product from inventory_requisition_detail where requisition = :_requisition)', {
                    type: QueryTypes.SELECT,
                    model: Stock,
                    replacements: {
                        sucursal: requisition.origin,
                        _requisition: requisition.id
                    }
                });

                let stocks = {};
                tmp.forEach(e => stocks[e.product] = e);

                //buscar las reservas

                tmp = await sequelize.query('SELECT * FROM `inventory_product_stock_reserve` WHERE orderId in (select id from inventory_requisition_detail where requisition = :_requisition)', {
                    type: QueryTypes.SELECT,
                    model: StockReserve,
                    replacements: {
                        sucursal: requisition.origin,
                        _requisition: requisition.id
                    }
                });

                let reserves = {};
                tmp.forEach(e => reserves[e.orderId] = e);
                let destino = await Sucursal.findByPk(requisition.destino);
                let sucursal = await Sucursal.findByPk(requisition.origin);

                let details_bodyes = {};
                let movements_bodyes = {};

                return await sequelize.transaction(async (t) => {
                    //crear el envio
                    let shipment = await Shipment.create({
                        type: 'transfer',
                        createdBy,
                        transportsBy: data.transporta,
                        requestedBy: requisition.createdBy,
                        direction: destino.location,
                        originSucursal: requisition.origin,
                        destinoSucursal: destino.id
                    }, { transaction: t });

                    var concept = `Solicitud de Transferencia #${requisition.id} desde ${sucursal.name} hacia ${destino.name} ENVIO N° TR-${sucursal.id}-${destino.id}-${shipment.id}`;

                    let len = details.length;


                    for (let index = 0; index < len; index++) {
                        let dt = details[index],
                            product = products[dt.product],
                            stock = stocks[dt.product],
                            reserve = reserves[dt.id];
                        console.log(product, stock, reserve);
                        if (product == undefined || stock == undefined || reserve == undefined) {
                            throw `Product or Stock not Found ${dt.id}`;
                        }

                        //Recopilar aqui la informacion para consolidarla
                        if (details_bodyes[dt.product] == undefined || details_bodyes[dt.product] == null) {

                            let __array = new Array();
                            if (dt.sale_detail !== undefined && dt.sale_detail !== null) {
                                __array.push({
                                    id: dt.sale_detail,
                                    cant: dt.cant,
                                    by: dt.createdBy,
                                });

                            }

                            details_bodyes[dt.product] = {
                                shipment: shipment.id,
                                product: dt.product,
                                cant: dt.cant,
                                cost: product.cost,
                                description: `${product.name} (SKU#${product.sku})`,
                                sale_detail: __array,
                            };

                            movements_bodyes[dt.product] = {
                                product: dt.product,
                                sucursal: stock.sucursal,
                                cant: dt.cant,
                                last_sucursal_stock: stock.cant,
                                last_product_stock: product.stock,
                                cost: product.cost,
                                last_cost: product.cost,
                                sale_detail: null,
                                concept: concept,
                                in: false,
                                createdBy,
                            }

                        } else {
                            details_bodyes[dt.product].cant += dt.cant;
                            movements_bodyes[dt.product].cant += dt.cant;

                            if (dt.sale_detail !== undefined && dt.sale_detail !== null) {
                                details_bodyes[dt.product].sale_detail.push({
                                    id: dt.sale_detail,
                                    cant: dt.cant
                                });
                            }
                        }
                        //destruir la reserva
                        await reserve.destroy({ transaction: t });
                    }

                    let keys = Object.keys(details_bodyes);

                    for (let index = 0; index < keys.length; index++) {
                        let detail_body = details_bodyes[keys[index]];
                        let product = products[detail_body.product],
                            stock = stocks[detail_body.product];

                        let detail = await ShipmentDetail.create(detail_body, { transaction: t });
                        let movement = await Movement.create(movements_bodyes[keys[index]], { transaction: t });

                        //Actualizar el producto descontando la cantidad
                        product.stock -= detail_body.cant;
                        product.reserved -= detail_body.cant;
                        await product.save({ transaction: t });

                        stock.cant -= detail_body.cant;
                        stock.reserved -= detail_body.cant;
                        await stock.save({ transaction: t });
                    }

                    requisition._status = "closed";
                    await requisition.save({ transaction: t });
                    return res.json({ status: 'success', message: 'Guardado', shipment });
                });

            }
            return Helper.notFound(req, res, 'Requisition not Found');
        } catch (error) {
            console.error(error);
            return res.json({ status: 'error', message: error.message, error: error });
        }
    },

    proccessRequisitionOLD: async (req, res) => {
        let data = req.body;
        let createdBy = req.session.userSession.shortName;
        if (data.transporta.length < 3) {
            return res.json({ status: 'errorMessage', message: "Indique el nombre de la persona que transportara el producto" });
        }


        try {
            //buscar la requisition
            let requisition = await Requisition.findByPk(data.requisition);
            if (requisition && requisition._status !== "closed") {
                //buscar los detalles

                let details = await RequisitionDetail.findAll({
                    where: {
                        requisition: requisition.id,
                    }
                });

                if (details.length < 1) {
                    return res.json({ status: 'errorMessage', message: "Agregue detalles al cuerpo de la Solicitud" });
                }

                //buscar los productos
                let tmp = await sequelize.query('SELECT * FROM `inventory_product` WHERE id in (select product from inventory_requisition_detail where requisition = :_requisition)', {
                    type: QueryTypes.SELECT,
                    model: Product,
                    replacements: {
                        _requisition: requisition.id
                    }
                });
                let products = {};
                tmp.forEach(e => products[e.id] = e);

                //buscar los stock
                tmp = await sequelize.query('SELECT * FROM `inventory_product_stock` WHERE sucursal = :sucursal and product in (select product from inventory_requisition_detail where requisition = :_requisition)', {
                    type: QueryTypes.SELECT,
                    model: Stock,
                    replacements: {
                        sucursal: requisition.origin,
                        _requisition: requisition.id
                    }
                });

                let stocks = {};
                tmp.forEach(e => stocks[e.product] = e);

                //buscar las reservas

                tmp = await sequelize.query('SELECT * FROM `inventory_product_stock_reserve` WHERE orderId in (select id from inventory_requisition_detail where requisition = :_requisition)', {
                    type: QueryTypes.SELECT,
                    model: StockReserve,
                    replacements: {
                        sucursal: requisition.origin,
                        _requisition: requisition.id
                    }
                });

                let reserves = {};
                tmp.forEach(e => reserves[e.orderId] = e);
                let destino = await Sucursal.findByPk(requisition.destino);
                let sucursal = await Sucursal.findByPk(requisition.origin);

                return await sequelize.transaction(async (t) => {
                    //crear el envio
                    let shipment = await Shipment.create({
                        type: 'transfer',
                        createdBy,
                        transportsBy: data.transporta,
                        requestedBy: requisition.createdBy,
                        direction: destino.location,
                        originSucursal: requisition.origin,
                        destinoSucursal: destino.id
                    }, { transaction: t });

                    var concept = `Solicitud de Transferencia #${requisition.id} desde ${sucursal.name} hacia ${destino.name} ENVIO N° TR-${sucursal.id}-${destino.id}-${shipment.id}`;

                    let len = details.length;


                    for (let index = 0; index < len; index++) {
                        let dt = details[index],
                            product = products[dt.product],
                            stock = stocks[dt.product],
                            reserve = reserves[dt.id];

                        if (product == undefined || stock == undefined || reserve == undefined) {
                            throw "Product or Stock not Found";
                        }


                        //redactar el cuerpo del detalle
                        //guardar el cuerpo del detalle
                        let detail = await ShipmentDetail.create({
                            shipment: shipment.id,
                            product: dt.product,
                            cant: dt.cant,
                            cost: product.cost,
                            description: `${product.name} (SKU#${product.sku})`,
                        }, { transaction: t });
                        //agregar a los detaLLES
                        // _details.push(detail);


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
                            createdBy,
                        }, { transaction: t });


                        //destruir la reserva
                        await reserve.destroy({ transaction: t });

                        //Actualizar el producto descontando la cantidad
                        product.stock -= dt.cant;
                        product.reserved -= dt.cant;
                        await product.save({ transaction: t });

                        stock.cant -= dt.cant;
                        stock.reserved -= dt.cant;
                        await stock.save({ transaction: t });
                    }

                    requisition._status = "closed";
                    await requisition.save({ transaction: t });

                    return res.json({ status: 'success', message: 'Guardado', shipment });
                });

            }
            return Helper.notFound(req, res, 'Requisition not Found');
        } catch (error) {
            console.error(error);
            return res.json({ status: 'error', message: error.message });
        }
    },

    inventory_report_per_dates: async (req, res) => {
        let sucursals = await Sucursal.findAll();
        return res.render('Inventory/Stock/stock_report_detailed', {
            pageTitle: 'Inventario general',
            sucursals,
        });
    },

    inventory_report_details_old: async (req, res) => {
        //obtengo todos los productos
        let selected_date = `${req.query.selected_date} 23:59:59`;
        let sucursal = await Sucursal.findByPk(req.query.sucursal);

        if (sucursal == null) {
            return res.json({
                status: 'error',
                message: "Sucursal not Found",
            })
        }

        let sql = 'select inventory_product.name, inventory_product.id, inventory_product.internal_code, inventory_product.classification as class, inventory_product.cost, inventory_product_classification.id as class_id, inventory_product_classification.name as class_name, inventory_product_classification._group from inventory_product INNER JOIN inventory_product_classification on inventory_product_classification.id = inventory_product.classification where inventory_product.id in(SELECT DISTINCT(product) FROM `inventory_product_movement` WHERE createdAt <= :date and sucursal = :sucursal) order by inventory_product.id ASC';

        let products = {};
        let tmp = await sequelize.query(sql, { replacements: { date: selected_date, sucursal: sucursal.id }, type: QueryTypes.SELECT });
        tmp.forEach(el => {
            // console.log(el);
            products[el.id] = el;
        });


        let result = {
            name: sucursal.name,
            valor: 0.00,
            groups: {
                'Carteras': {
                    total: 0.00,
                    details: [],
                },
                'Mochilas': {
                    total: 0.00,
                    details: [],
                },
                'Relojes': {
                    total: 0.00,
                    details: [],
                },
                'Electrodomesticos': {
                    total: 0.00,
                    details: [],
                },
                'Tecnologia': {
                    total: 0.00,
                    details: [],
                },
                'Productos para el Hogar': {
                    total: 0.00,
                    details: [],
                },
                'Productos y accesorios para niños': {
                    total: 0.00,
                    details: [],
                },
                'Accesorios para dama': {
                    total: 0.00,
                    details: [],
                },

            }
        }

        //recorrer los productos, clasificarlos y obtener su movimiento

        let indexes = Object.keys(products);
        let len = indexes.length;

        for (let index = 0; index < len; index++) {
            let i = indexes[index];
            let product = products[i];
            let move = await Movement.findOne({
                where: {
                    product: product.id,
                    sucursal: sucursal.id,
                    createdAt: {
                        [Op.lte]: selected_date,
                    }
                },
                order: [['id', 'DESC']],
            });

            let cant = 0, cost = 0.00;
            //determinar la cantidad

            if (move.in == true || move.in == 1) {
                cant = move.last_sucursal_stock + move.cant;
                cost = ((move.last_sucursal_stock * move.last_cost) + (move.cant * move.cost)) / cant;
            } else {
                cant = Number.parseInt(move.last_sucursal_stock) - Number.parseInt(move.cant);
                cost = move.cost;
            }



            let detail = {
                id: product.id,
                name: product.name,
                sku: product.internal_code,
                cant: cant,
                cost: cost,
                subtotal: Helper.fix_number((cant * cost)),
                fecha: move.createdAt
            }

            result['groups'][product._group].total = Helper.fix_number(result['groups'][product._group].total) + Helper.fix_number(detail.subtotal);
            result['groups'][product._group]['details'].push(detail);
            result.valor = Helper.fix_number(result.valor) + Helper.fix_number(detail.subtotal);
        }


        return res.json(result);


    },

    inventory_report_details_vieja: async (req, res) => {
        //obtengo todos los productos
        let selected_date = `${req.query.selected_date} 23:59:59`;
        let sucursal = await Sucursal.findByPk(req.query.sucursal);

        if (sucursal == null) {
            return res.json({
                status: 'error',
                message: "Sucursal not Found",
            })
        }

        let sql = 'select inventory_product.name, inventory_product.id, inventory_product.internal_code, inventory_product.classification as class, inventory_product.cost, inventory_product_classification.id as class_id, inventory_product_classification.name as class_name, inventory_product_classification._group from inventory_product INNER JOIN inventory_product_classification on inventory_product_classification.id = inventory_product.classification where inventory_product.id in(SELECT DISTINCT(product) FROM `inventory_product_movement` WHERE createdAt <= :date and sucursal = :sucursal) order by inventory_product.id ASC';

        let products = {};
        let tmp = await sequelize.query(sql, { replacements: { date: selected_date, sucursal: sucursal.id }, type: QueryTypes.SELECT });
        tmp.forEach(el => {
            // console.log(el);
            products[el.id] = el;
        });


        let result = {
            name: sucursal.name,
            valor: 0.00,
            groups: {
                'Carteras': {
                    total: 0.00,
                    details: [],
                },
                'Mochilas': {
                    total: 0.00,
                    details: [],
                },
                'Relojes': {
                    total: 0.00,
                    details: [],
                },
                'Electrodomesticos': {
                    total: 0.00,
                    details: [],
                },
                'Tecnologia': {
                    total: 0.00,
                    details: [],
                },
                'Productos para el Hogar': {
                    total: 0.00,
                    details: [],
                },
                'Productos y accesorios para niños': {
                    total: 0.00,
                    details: [],
                },
                'Accesorios para dama': {
                    total: 0.00,
                    details: [],
                },

            }
        }

        //recorrer los productos, clasificarlos y obtener su movimiento

        let indexes = Object.keys(products);
        let len = indexes.length;

        for (let index = 0; index < len; index++) {
            let i = indexes[index];
            let product = products[i];
            let move = await Movement.findOne({
                where: {
                    product: product.id,
                    sucursal: sucursal.id,
                    createdAt: {
                        [Op.lte]: selected_date,
                    }
                },
                order: [['id', 'DESC']],
            });

            let cant = 0, cost = 0.00;
            //determinar la cantidad

            if (move.in == true || move.in == 1) {
                cant = move.last_sucursal_stock + move.cant;
                cost = ((move.last_sucursal_stock * move.last_cost) + (move.cant * move.cost)) / cant;
            } else {
                cant = Number.parseInt(move.last_sucursal_stock) - Number.parseInt(move.cant);
                cost = move.cost;
            }



            let detail = {
                id: product.id,
                name: product.name,
                sku: product.internal_code,
                cant: cant,
                cost: cost,
                subtotal: Helper.fix_number((cant * cost)),
                fecha: move.createdAt
            }

            result['groups'][product._group].total = Helper.fix_number(result['groups'][product._group].total) + Helper.fix_number(detail.subtotal);
            result['groups'][product._group]['details'].push(detail);
            result.valor = Helper.fix_number(result.valor) + Helper.fix_number(detail.subtotal);
        }


        return res.json(result);


    },

    inventory_report_details: async (req, res) => {
        let selected_date = new Date(`${req.query.selected_date} 23:59:59`);
        let sucursal = await Sucursal.findByPk(req.query.sucursal);
        let zeros = req.query.zeros;

        if (sucursal == null) {
            return res.json({
                status: 'error',
                message: "Sucursal not Found",
            })
        }

        let result = {
            name: sucursal.name,
            valor: 0.00,
            groups: {}
        }

        //buscar las clasificaciones
        let tmp = await ProductClassification.findAll();
        let clasificaciones = {};
        tmp.forEach(e => {

            if (result['groups'][e._group] == undefined || result['groups'][e._group] == null) {
                result['groups'][e._group] = {
                    total: 0.00,
                    details: [],
                }
            }

            clasificaciones[e.id] = e;
        });


        //buscar los productos que tengan registro de stock en la sucursal seleccionada
        tmp = await sequelize.query('SELECT * FROM `inventory_product` WHERE id in(SELECT DISTINCT(product) FROM `inventory_product_stock` WHERE sucursal = :sucursal)', {
            type: QueryTypes.SELECT,
            model: Product,
            replacements: {
                sucursal: sucursal.id
            }
        });
        let products = {};
        tmp.forEach(e => products[e.id] = e);

        //buscar los movimientos de esos productos hasta la fecha seleccionada, podemos hacerlos por medio de lotes para no sobrecargar el servidor de base de datos e ir acumulando la informacion en un arreglo.

        let sql = `WITH RankedMovements AS ( SELECT inventory_product_movement.*, ROW_NUMBER() OVER(PARTITION BY product ORDER BY createdAt DESC) as rn FROM inventory_product_movement WHERE sucursal = :sucursal AND createdAt <= :date ) SELECT rm.* FROM RankedMovements rm WHERE rm.rn = 1;`
        //ordenar los movimientos dando el ultimo movimiento de cada producto, si ya hay un movimiento anterior se puede comparar la fecha y obtener la fecha mas reciente.

        tmp = await sequelize.query(sql, {
            type: QueryTypes.SELECT,
            model: Movement,
            replacements: {
                sucursal: sucursal.id,
                date: selected_date
            }
        });

        if (zeros == "SI") {

            tmp.forEach(move => {
                let product = products[move.product];
                let cant = 0, cost = 0.00;
                //determinar la cantidad

                if (move.in == true || move.in == 1) {
                    cant = move.last_sucursal_stock + move.cant;
                    cost = ((move.last_sucursal_stock * move.last_cost) + (move.cant * move.cost)) / cant;
                } else {
                    cant = Number.parseInt(move.last_sucursal_stock) - Number.parseInt(move.cant);
                    cost = move.cost;
                }

                let detail = cant > 0 ? {
                    id: product.id,
                    name: product.name,
                    sku: product.internal_code,
                    cant: cant,
                    cost: cost,
                    subtotal: Helper.fix_number((cant * cost)),
                    fecha: move.createdAt
                } : {
                    id: product.id,
                    name: product.name,
                    sku: product.internal_code,
                    cant: 0,
                    cost: 0.00,
                    subtotal: 0.00,
                    fecha: move.createdAt
                }

                let cla = clasificaciones[product.classification]._group;


                result['groups'][cla].total = Helper.fix_number(result['groups'][cla].total) + Helper.fix_number(detail.subtotal);
                result['groups'][cla]['details'].push(detail);
                result.valor = Helper.fix_number(result.valor) + Helper.fix_number(detail.subtotal);
            });


        } else {
            tmp.forEach(move => {
                let product = products[move.product];
                let cant = 0, cost = 0.00;
                //determinar la cantidad

                if (move.in == true || move.in == 1) {
                    cant = move.last_sucursal_stock + move.cant;
                    cost = ((move.last_sucursal_stock * move.last_cost) + (move.cant * move.cost)) / cant;
                } else {
                    cant = Number.parseInt(move.last_sucursal_stock) - Number.parseInt(move.cant);
                    cost = move.cost;
                }

                if (cant > 0) {
                    let detail = {
                        id: product.id,
                        name: product.name,
                        sku: product.internal_code,
                        cant: cant,
                        cost: cost,
                        subtotal: Helper.fix_number((cant * cost)),
                        fecha: move.createdAt
                    }

                    let cla = clasificaciones[product.classification]._group;


                    result['groups'][cla].total = Helper.fix_number(result['groups'][cla].total) + Helper.fix_number(detail.subtotal);
                    result['groups'][cla]['details'].push(detail);
                    result.valor = Helper.fix_number(result.valor) + Helper.fix_number(detail.subtotal);

                }
            });
        }

        return res.json(result);

    },



    reporte_detallado: async (req, res) => {
        let sql = 'select inventory_product.name, inventory_product.id, inventory_product.internal_code, inventory_product.classification as class, inventory_product.cost, inventory_product_classification.id as class_id, inventory_product_classification.name as class_name, inventory_product_classification._group from inventory_product INNER JOIN inventory_product_classification on inventory_product_classification.id = inventory_product.classification where inventory_product.stock > 0';

        let products = {};
        let tmp = await sequelize.query(sql, { type: QueryTypes.SELECT });
        tmp.forEach(el => products[el.id] = el);


        tmp = await Sucursal.findAll();
        let sucursals = {};



        tmp.forEach(element => {
            sucursals[element.id] = {
                name: element.name,
                valor: 0.00,
                valor_: 0.00,
                groups: {
                    'Carteras': {
                        total: 0.00,
                        total_: 0.00,
                        details: [],
                    },
                    'Mochilas': {
                        total: 0.00,
                        total_: 0.00,
                        details: [],
                    },
                    'Relojes': {
                        total: 0.00,
                        total_: 0.00,
                        details: [],
                    },
                    'Electrodomesticos': {
                        total: 0.00,
                        total_: 0.00,
                        details: [],
                    },
                    'Tecnologia': {
                        total: 0.00,
                        total_: 0.00,
                        details: [],
                    },
                    'Productos para el Hogar': {
                        total: 0.00,
                        total_: 0.00,
                        details: [],
                    },
                    'Productos y accesorios para niños': {
                        total: 0.00,
                        total_: 0.00,
                        details: [],
                    },
                    'Accesorios para dama': {
                        total: 0.00,
                        total_: 0.00,
                        details: [],
                    },

                }
            }
        });



        tmp = await Stock.findAll({
            where: { cant: { [Op.gt]: 0 } }
        });


        tmp.forEach(stock => {
            //buscar el producto
            let product = products[stock.product];
            let detail = {
                id: product.id,
                name: product.name,
                sku: product.internal_code,
                cant: stock.cant,
                reserved: stock.reserved,
                cost: product.cost,
                subtotal: Number.parseFloat(product.cost) * Number.parseInt(stock.cant),
                subtotal_: Number.parseFloat(product.cost) * Number.parseInt(stock.reserved),
            }

            //determinar la sucursal
            ///sucursal 1 grupo accesosrios
            sucursals[stock.sucursal]['groups'][product._group].total += detail.subtotal;
            sucursals[stock.sucursal]['groups'][product._group].total_ += detail.subtotal_;
            sucursals[stock.sucursal]['groups'][product._group]['details'].push(detail);
            sucursals[stock.sucursal].valor += detail.subtotal;
            sucursals[stock.sucursal].valor_ += detail.subtotal_;

        });

        return res.render('Inventory/Stock/stock_report_detailed', {
            pageTitle: 'Inventario general',
            sucursals,
        });
    },


    general_report: async (req, res) => {
        let products = await Product.findAll({ where: { stock: { [Op.gt]: 0 } } });


        return res.render('Inventory/Product/stock_report', {
            pageTitle: 'Inventario general',
            products,
        });
    },

    reserveList: async (req, res) => {
        let products = {}, sales = {}, clients = {}, sucursals = {};

        //obtener los productos
        let tmp = await Product.findAll({
            where: {
                id: { [Op.in]: sequelize.literal(`(SELECT product FROM inventory_product_stock_reserve)`) }
            }
        });
        tmp.forEach(element => products[element.id] = element);

        //obtener los clientes
        tmp = await Client.findAll({
            where: {
                id: { [Op.in]: sequelize.literal("(select client from crm_sale where crm_sale.id in(select sale from crm_sale_detail where id in (SELECT saleId FROM inventory_product_stock_reserve where inventory_product_stock_reserve.type = 'sale')))") }
            }
        });
        tmp.forEach(element => clients[element.id] = element.name);
        //obtener el vendedor que registro la venta o quien registro el detalle

        tmp = await Sale.findAll({
            where: {
                id: {
                    [Op.in]: sequelize.literal('(select sale from crm_sale_detail where id in (SELECT saleId FROM inventory_product_stock_reserve))')
                }
            }
        });
        tmp.forEach(e => {
            sales[e.id] = { sale: e, details: [] };
        });

        tmp = await Sucursal.findAll();
        tmp.forEach(e => sucursals[e.id] = e.name);

        //buscar las reservas e indexarlas
        tmp = await sequelize.query('SELECT crm_sale_detail.sale, crm_sale_detail.ready, inventory_product_stock_reserve.* FROM `crm_sale_detail` inner join inventory_product_stock_reserve on inventory_product_stock_reserve.saleId = crm_sale_detail.id order by crm_sale_detail.sale', { type: QueryTypes.SELECT });
        tmp.forEach(reserve => {
            if (sales[reserve.sale] !== undefined) {
                sales[reserve.sale].details.push(reserve);
            } else {
                //enviar una notificacion de que esta reserva no tiene venta relacionada

            }
        })

        console.log(clients)

        return res.render('Inventory/Stock/reserveList', {
            pageTitle: 'lista de Reservas',
            sales,
            clients,
            products,
            sucursals
        });

    },

    printShipment: async (req, res) => {
        let shipment = await Shipment.findByPk(req.params.id);
        if (shipment !== undefined && shipment !== null) {
            let sucursals = {};
            let shipment_details = await Sucursal.findAll({ attributes: ['id', 'name'] });
            shipment_details.forEach(el => sucursals[el.id] = el.name);

            shipment_details = await ShipmentDetail.findAll({
                where: {
                    shipment: shipment.id
                }
            });
            return res.render('Inventory/Stock/printShipment', {
                pageTitle: 'Envio ' + shipment.id,
                sucursals,
                shipment, shipment_details,
            });
        }

        return Helper.notFound(req, res, 'Shipment not Found');
    },

    viewShipments: async (req, res) => {
        let init = null, end = null;
        if (req.query.init !== undefined) {
            init = req.query.init;
            end = req.query.end;
        } else {
            let d = new Date();
            let m = d.getMonth() + 1;
            m = m > 9 ? m : '0' + m;
            let day = d.getDate();
            day = day > 9 ? day : '0' + day;

            init = `${d.getFullYear()}-${m}-01T00:00:00`;
            d.setHours(d.getHours() + 6);
            end = `${d.getFullYear()}-${m}-${day}T23:59:59`;
        }

        let shipments = await Shipment.findAll({
            where: {
                isIn: true,
                createdAt: { [Op.between]: [init, end], }
            }
        });

        let shipments_not_in = await Shipment.findAll({
            where: {
                isIn: false,
            }
        });

        let tmp = await Sucursal.findAll({});
        let sucursals = {};

        tmp.forEach(e => sucursals[e.id] = e.name);

        //buscar los envios Generados

        return res.render('Inventory/Stock/shipments', {
            pageTitle: 'Envios generados',
            sucursals,
            init, end, shipments, shipments_not_in
        });
    },
    viewShipment: async (req, res) => {
        let shipment = await Shipment.findByPk(req.params.id).catch(err => next(err));
        if (shipment !== undefined && shipment !== null) {
            let sucursals = {};
            let shipment_details = await Sucursal.findAll({ attributes: ['id', 'name'] });
            shipment_details.forEach(el => sucursals[el.id] = el.name);

            // shipment_details = await ShipmentDetail.findAll({
            //     where: {
            //         shipment: shipment.id
            //     }
            // });


            shipment_details = await sequelize.query(
                'SELECT inventory_shipment_detail.*, inventory_product.image FROM `inventory_shipment_detail` INNER join inventory_product on inventory_shipment_detail.product = inventory_product.id where inventory_shipment_detail.shipment = :shipment',
                {
                    replacements: { shipment: shipment.id },
                    type: QueryTypes.SELECT
                }
            );

            return res.render('Inventory/Stock/shipment', {
                pageTitle: 'Envio ' + shipment.id,
                sucursals,
                shipment, shipment_details,
            });
        }

        return Helper.notFound(req, res, 'Shipment not Found');
    },
    newShipment: async (req, res) => {
        let sucursals = await Sucursal.findAll({ attributes: ['id', 'name'] });
        return res.render('Inventory/Stock/newShipment', {
            pageTitle: 'Envios generados',
            sucursals,
        });
    },
    saveShipment: async (req, res) => {
        let data = req.body;
        let session = req.session.userSession;
        //verificar los datos
        if (data.details.length < 1) {
            return res.json({ status: 'error', message: 'Agregue los productos que va a trasladar' });
        } else if (data.sucursal == data.destino) {
            return res.json({ status: 'error', message: 'La sucursal de origen y destino deben ser diferentes' });
        } else if (data.requestedBy.length < 5) {
            return res.json({ status: 'error', message: 'Indique quien ha solicitado el traslado' });
        } else if (data.trasnportedBy.length < 5) {
            return res.json({ status: 'error', message: 'Indique quien realizara el traslado' });
        } else {
            var sucursal = await Sucursal.findByPk(data.sucursal);
            var destino = await Sucursal.findByPk(data.destino);

            try {
                var ids = [], products = {}, stocks = {};
                return await sequelize.transaction(async (t) => {

                    //crear el envio
                    let shipment = await Shipment.create({
                        type: 'transfer',
                        createdBy: session.shortName,
                        transportsBy: data.trasnportedBy,
                        requestedBy: data.requestedBy,
                        direction: destino.location,
                        originSucursal: sucursal.id,
                        destinoSucursal: destino.id
                    }, { transaction: t });

                    //recorrer los detalles de y obtener los ID de los productos
                    data.details.forEach(detail => ids.push(detail.product));
                    //buscar los productos
                    let tmp = await Product.findAll({
                        where: { id: { [Op.in]: ids } }
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

                    var len = data.details.length;
                    var concept = `Transferencia desde ${sucursal.name} hacia ${destino.name} ENVIO N° TR-${sucursal.id}-${destino.id}-${shipment.id}`;

                    for (let index = 0; index < len; index++) {
                        let dt = data.details[index],
                            product = products[dt.product],
                            stock = stocks[dt.product];

                        if (product == undefined || stock == undefined) {
                            throw "Product or Stock not Found";
                        }

                        let max = stock.cant - stock.reserved;

                        if (dt.cant > max) {
                            dt.cant = max;
                        }
                        //redactar el cuerpo del detalle
                        //guardar el cuerpo del detalle
                        let detail = await ShipmentDetail.create({
                            shipment: shipment.id,
                            product: dt.product,
                            cant: dt.cant,
                            cost: product.cost,
                            description: `${product.name} (SKU#${product.sku})`,
                        }, { transaction: t });
                        //agregar a los detaLLES


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
                            createdBy: session.shortName,
                        }, { transaction: t });

                        //Actualizar el producto descontando la cantidad
                        product.stock -= dt.cant;
                        await product.save({ transaction: t });

                        stock.cant -= dt.cant;
                        await stock.save({ transaction: t });

                    }

                    return res.json({ status: 'success', message: 'Guardado', shipment })
                });
            } catch (error) {
                console.error(error);
                return res.json({ status: 'error', message: error.message })
            }
        }

    },
    //saving via socket
    saveTransferShipment: async (data, session) => {
        //verificar los datos
        if (data.details.length < 1) {
            return { status: 'error', message: 'Agregue los productos que va a trasladar' }
        } else if (data.sucursal == data.destino) {
            return { status: 'error', message: 'La sucursal de origen y destino deben ser diferentes' }
        } else if (data.requestedBy.length < 5) {
            return { status: 'error', message: 'Indique quien ha solicitado el traslado' }
        } else if (data.trasnportedBy.length < 5) {
            return { status: 'error', message: 'Indique quien realizara el traslado' }
        } else {
            var sucursal = await Sucursal.findByPk(data.sucursal);
            var destino = await Sucursal.findByPk(data.destino);

            try {
                var ids = [], products = {}, stocks = {}, _details = [];
                return await sequelize.transaction(async (t) => {

                    //crear el envio
                    let shipment = await Shipment.create({
                        type: 'transfer',
                        createdBy: session.shortName,
                        transportsBy: data.trasnportedBy,
                        requestedBy: data.requestedBy,
                        direction: destino.location,
                        originSucursal: sucursal.id,
                        destinoSucursal: destino.id
                    }, { transaction: t });

                    //recorrer los detalles de y obtener los ID de los productos
                    data.details.forEach(detail => ids.push(detail.product));
                    //buscar los productos
                    let tmp = await Product.findAll({
                        where: { id: { [Op.in]: ids } }
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

                    var len = data.details.length;
                    var concept = `Transferencia desde ${sucursal.name} hacia ${destino.name} ENVIO N° TR-${sucursal.id}-${destino.id}-${shipment.id}`;

                    for (let index = 0; index < len; index++) {
                        let dt = data.details[index],
                            product = products[dt.product],
                            stock = stocks[dt.product];

                        if (product == undefined || stock == undefined) {
                            throw "Product or Stock not Found";
                        }

                        let max = stock.cant - stock.reserved;

                        if (dt.cant > max) {
                            dt.cant = max;
                        }
                        //redactar el cuerpo del detalle
                        //guardar el cuerpo del detalle
                        let detail = await ShipmentDetail.create({
                            shipment: shipment.id,
                            product: dt.product,
                            cant: dt.cant,
                            cost: product.cost,
                            description: `${product.name} (SKU#${product.sku})`,
                        }, { transaction: t });
                        //agregar a los detaLLES
                        _details.push(detail);


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
                            createdBy: session.shortName,
                        }, { transaction: t });

                        //Actualizar el producto descontando la cantidad
                        product.stock -= dt.cant;
                        await product.save({ transaction: t });

                        stock.cant -= dt.cant;
                        await stock.save({ transaction: t });

                    }

                    return { status: 'success', message: 'Guardado', shipment, _details }
                });
            } catch (error) {
                console.error(error);
                return { status: 'error', message: error.message }
            }
        }

    },
    inShipmentOLD: async (req, res) => {
        let data = req.body;
        let shipment = await Shipment.findByPk(data.shipment).catch(err => next(err));
        if (shipment != null) {
            if (shipment.isIn == true || shipment.isIn == 1) {
                return Helper.notFound(req, res, 'Transaccion Duplicada');
            }
            let details = await ShipmentDetail.findAll({ where: { shipment: shipment.id } });

            let tmp = await Product.findAll({
                where: { id: { [Op.in]: sequelize.literal(`(SELECT product FROM inventory_shipment_detail WHERE shipment = ${shipment.id})`,), } }
            });

            let products = {};
            tmp.forEach(element => { products[element.id] = element; });
            //buscar e indexar los stock
            tmp = await Stock.findAll({
                where: {
                    [Op.and]: {
                        sucursal: shipment.destinoSucursal,
                        product: {
                            [Op.in]: sequelize.literal(`(SELECT product FROM inventory_shipment_detail WHERE shipment = ${shipment.id})`),
                        },
                    }
                }
            });
            let stocks = {};
            tmp.forEach(element => { stocks[element.product] = element; });

            tmp = await Sucursal.findAll({ attributes: ['id', 'name'] });
            let sucursales = {};
            tmp.forEach(element => { sucursales[element.id] = element.name; });


            let len = details.length;
            let concept = `Transferencia desde ${sucursales[shipment.originSucursal]} hacia ${sucursales[shipment.destinoSucursal]} ENVIO N° TR-${shipment.originSucursal}-${shipment.destinoSucursal}-${shipment.id}`;
            try {
                const result = await sequelize.transaction(async (t) => {
                    let faltan = false;
                    for (let index = 0; index < len; index++) {
                        let detail = details[index];
                        let _cant = Number.parseInt(data.details[detail.id]);
                        if (_cant > 0) {
                            let product = products[detail.product];
                            let stock = stocks[detail.product];

                            //Si el stock existe, aumentamos la cantidad existente
                            let last_sucursal_stock = 0;


                            if (stock === undefined || stock == null) {
                                //Si no existe lo creamos con la cantidad inicial del ingreso
                                stock = await Stock.create({
                                    'product': product.id,
                                    'sucursal': shipment.destinoSucursal,
                                    'cant': _cant,
                                    'reserved': 0,
                                }, { 'transaction': t });

                            } else {
                                last_sucursal_stock = stock.cant;
                                stock.cant += _cant;
                                await stock.save({ 'transaction': t });

                            }

                            //calcular el costo promedio y actualizar el registro del producto
                            let last_cost = product.cost;
                            let last_stock = product.stock;

                            product.cost = ((last_cost * last_stock) + (detail.cost * _cant)) / (_cant + last_stock);
                            product.stock += _cant;
                            product.last_cost = last_cost;

                            //Actualizar cantidad y costo del producto
                            await product.save({ transaction: t });

                            //registrar el movimiento
                            let move = await Movement.create({
                                last_sucursal_stock: last_sucursal_stock,
                                last_product_stock: last_stock,
                                cant: _cant,
                                cost: detail.cost,
                                last_cost: last_cost,
                                in: true,
                                product: product.id,
                                concept: concept,
                                sucursal: stock.sucursal,
                                createdBy: req.session.userSession.shortName,
                            }, { transaction: t });

                            detail.in += _cant;
                            await detail.save({ transaction: t });

                            if (detail.in < detail.cant) {
                                faltan = true;
                            }
                        } else {
                            faltan = true;
                        }
                    }

                    if (faltan === false) {
                        shipment.receivedBy = req.session.userSession.shortName;
                        shipment.isIn = true;
                        await shipment.save({ transaction: t });
                    }




                });

                //transaction commit
                return res.json({
                    status: 'success',
                    message: 'Guardado con exito',
                });

            } catch (error) {
                console.log(error);
                return res.status(500).json({ 'error': 'Internal Server Error' });
            }

            return Helper.notFound(req, res, 'Transaction or Resource not Found');

        }

        return Helper.notFound(req, res, 'Transaction or Resource not Found');
    },

    inShipment: async (req, res) => {
        let data = req.body;
        let shipment = await Shipment.findByPk(data.shipment).catch(err => next(err));
        if (shipment != null) {
            console.log(shipment.isIn)
            if (shipment.isIn == true || shipment.isIn == 1) {
                return Helper.notFound(req, res, 'Transaccion Duplicada');
            }


            let details = await ShipmentDetail.findAll({ where: { shipment: shipment.id } });

            let tmp = await Product.findAll({
                where: { id: { [Op.in]: sequelize.literal(`(SELECT product FROM inventory_shipment_detail WHERE shipment = ${shipment.id})`,), } }
            });

            let products = {};
            tmp.forEach(element => { products[element.id] = element; });
            //buscar e indexar los stock
            tmp = await Stock.findAll({
                where: {
                    [Op.and]: {
                        sucursal: shipment.destinoSucursal,
                        product: {
                            [Op.in]: sequelize.literal(`(SELECT product FROM inventory_shipment_detail WHERE shipment = ${shipment.id})`),
                        },
                    }
                }
            });
            let stocks = {};
            tmp.forEach(element => { stocks[element.product] = element; });

            tmp = await Sucursal.findAll({ attributes: ['id', 'name'] });
            let sucursales = {};
            tmp.forEach(element => { sucursales[element.id] = element.name; });


            let len = details.length;
            let concept = `Transferencia desde ${sucursales[shipment.originSucursal]} hacia ${sucursales[shipment.destinoSucursal]} ENVIO N° TR-${shipment.originSucursal}-${shipment.destinoSucursal}-${shipment.id}`;
            try {
                const result = await sequelize.transaction(async (t) => {
                    let faltan = false;
                    for (let index = 0; index < len; index++) {
                        let detail = details[index];
                        let _cant = detail.cant;

                        let product = products[detail.product];
                        let stock = stocks[detail.product];



                        let reserved = 0;
                        if (detail.sale_detail.length > 0) {
                            //recorrer los detalles
                            let _largo = detail.sale_detail.length;
                            for (let _f = 0; _f < _largo; _f++) {
                                let _sale_detail = await SaleDetail.findByPk(detail.sale_detail[_f].id);
                                if (_sale_detail !== null && _sale_detail !== undefined) {
                                    _sale_detail.reserved += detail.sale_detail[_f].cant;
                                    await _sale_detail.save({ transaction: t });

                                    //Crear la reserva

                                    let reserve = await StockReserve.create({
                                        cant: detail.sale_detail[_f].cant,
                                        createdBy: detail.sale_detail[_f].by ?? req.session.userSession.shortName,
                                        concept: `Reserva por venta id ${_sale_detail.sale}`,
                                        type: 'sale',
                                        saleId: _sale_detail.id,
                                        product: _sale_detail.product,
                                        sucursal: shipment.destinoSucursal,
                                    }, { transaction: t });


                                    reserved += detail.sale_detail[_f].cant;


                                }
                            }
                        }

                        //Si el stock existe, aumentamos la cantidad existente
                        let last_sucursal_stock = 0;
                        if (stock === undefined || stock == null) {
                            //Si no existe lo creamos con la cantidad inicial del ingreso
                            stock = await Stock.create({
                                'product': product.id,
                                'sucursal': shipment.destinoSucursal,
                                'cant': _cant,
                                'reserved': reserved,
                            }, { 'transaction': t });

                        } else {
                            last_sucursal_stock = stock.cant;
                            stock.cant = (stock.cant + _cant);
                            stock.reserved = (stock.reserved + reserved);
                            await stock.save({ 'transaction': t });

                        }

                        //calcular el costo promedio y actualizar el registro del producto
                        let last_cost = product.cost;
                        let last_stock = product.stock;

                        product.cost = ((last_cost * last_stock) + (detail.cost * _cant)) / (_cant + last_stock);
                        product.stock = (product.stock + _cant);
                        product.reserved = (product.reserved + reserved);
                        product.last_cost = last_cost;

                        //Actualizar cantidad y costo del producto
                        await product.save({ transaction: t });

                        //registrar el movimiento
                        let move = await Movement.create({
                            last_sucursal_stock: last_sucursal_stock,
                            last_product_stock: last_stock,
                            cant: _cant,
                            cost: detail.cost,
                            last_cost: last_cost,
                            in: true,
                            product: product.id,
                            concept: concept,
                            sucursal: stock.sucursal,
                            createdBy: req.session.userSession.shortName,
                        }, { transaction: t });

                        detail.in += _cant;
                        await detail.save({ transaction: t });

                        if (detail.in < detail.cant) {
                            faltan = true;
                        }

                    }

                    shipment.receivedBy = req.session.userSession.shortName;
                    shipment.isIn = true;
                    await shipment.save({ transaction: t });
                });

                //transaction commit
                return res.json({
                    status: 'success',
                    message: 'Guardado con exito',
                });

            } catch (error) {
                console.log(error);
                return res.status(500).json({ 'error': 'Internal Server Error' });
            }

            return Helper.notFound(req, res, 'Transaction or Resource not Found');

        }

        return Helper.notFound(req, res, 'Transaction or Resource not Found');
    },
    kardex: async (req, res) => {
        let product = await Product.findByPk(req.params.id);
        return product === null ? res.status(404) : res.render('Inventory/Product/kardex', { product, pageTitle: product.name, });
    },

    kardexDetails: async (req, res) => {
        let product = await Product.findByPk(req.params.id);
        if (product === null) {
            return res.status(404);
        }

        let init = req.query.init;
        let end = req.query.end;

        //buscar los detalles 
        let details = await Movement.findAll({
            where: {
                [Op.and]: [
                    { product: product.id },
                    { createdAt: { [Op.between]: [init, end], } }
                ],
            }
        });

        // verificar si hay movimeintos

        if (details.length > 0) {
            //obtener el primer detalle
            let first = details[0];
            var _date = new Date(init);
            first = [{
                'number': 1,
                'date': Helper.format_date(init),
                'concept': 'Saldo Inicial a la fecha',
                'in_cant': '',
                'in_val': '',
                'in_sub': '',
                'out_cant': '',
                'out_val': '',
                'out_sub': '',
                'cant': first.last_product_stock,
                'val': first.last_product_stock > 0 ? `$ ${Money.money_format(first.last_cost)}` : '--',
                'sub': `$ ${Money.money_format(Number.parseFloat(first.last_product_stock * first.last_cost).toFixed(2))}`,
            }]

            let numb = 1;
            details = details.map(element => {
                numb++;
                if (element.in) {
                    // Si el movimeinto es una entrada entonces calculemos el costo promedio
                    let cant, prom = 0;
                    cant = (element.cant + element.last_product_stock);
                    prom = Number.parseFloat(((element.cant * element.cost) + (element.last_product_stock * element.last_cost)) / cant);

                    return {
                        'number': numb,
                        'date': Helper.format_date(element.createdAt),
                        'concept': element.concept,
                        'in_cant': element.cant,
                        'in_val': `$ ${Money.money_format(element.cost)}`,
                        'in_sub': `$ ${Money.money_format(Number.parseFloat(element.cant * element.cost).toFixed(2))}`,
                        'out_cant': '',
                        'out_val': '',
                        'out_sub': '',
                        'cant': cant,
                        'val': `$ ${Money.money_format(prom)}`,
                        'sub': `$ ${Money.money_format(Number.parseFloat(cant * prom).toFixed(2))}`,
                    }
                } else {
                    let cant = (element.last_product_stock - element.cant);
                    return {
                        'number': numb,
                        'date': Helper.format_date(element.createdAt),
                        'concept': element.concept,
                        'in_cant': '',
                        'in_val': '',
                        'in_sub': '',
                        'out_cant': element.cant,
                        'out_val': `$ ${Money.money_format(element.cost)}`,
                        'out_sub': `$ ${Money.money_format(Number.parseFloat(element.cant * element.cost).toFixed(2))}`,
                        'cant': cant,
                        'val': cant > 0 ? `$ ${Money.money_format(element.cost)}` : '--',
                        'sub': cant > 0 ? `$ ${Money.money_format(Number.parseFloat((element.last_product_stock - element.cant) * element.cost).toFixed(2))}` : '$ 0.00',
                    }
                }
            });

            details = first.concat(details);
            return res.json(details);
        }

        return res.json({
            details: [],
        })
    },
    in: async (req, res) => {
        let sucursals = await Sucursal.findAll({ attributes: ['id', 'name'] });
        let product = await Product.findByPk(req.params.id);
        return product === null ? res.status(404) : res.render('Inventory/Product/in', { product, pageTitle: product.name, sucursals, });
    },
    SaveIn: async (req, res) => {
        const t = await sequelize.transaction();
        try {
            let data = req.body;
            let product = await Product.findByPk(req.params.id);
            if (product === null) {
                return res.status(404).json({
                    status: 'errorMessage',
                    message: 'Producto no encontrado',
                });
            }

            //comprobar la sucursal
            let sucursal = await Sucursal.findByPk(data.sucursal);
            if (sucursal === null) {
                return res.status(404).json({
                    status: 'errorMessage',
                    message: 'la sucursal seleccionada no es correcta',
                });
            }

            data.cant = Number.parseInt(data.cant);
            data.cost = Number.parseFloat(data.cost);

            let error = null;
            if (data.concept.length < 10) {
                error = 'Proporcione una justificación de al menos 10 caracteres';
            } else if (data.cant < 1) {
                error = 'Ingrese una cantidad valida';
            } else if (data.price < 0.01) {
                error = 'Ingrese un costo valido';
            } else if (data.cant == '') {
                error = 'Seleccione una sucursal';
            }

            if (error !== null) {
                return res.json({
                    status: 'errorMessage',
                    message: message,
                });
            }
            //Compriobar si hay stocks creados en esa sucursal
            let stock = await Stock.findOne({
                where: {
                    [Op.and]: [
                        { 'product': req.params.id },
                        { 'sucursal': data.sucursal }
                    ],
                }
            });
            //Si el stock existe, aumentamos la cantidad existente
            let last_sucursal_stock = 0;
            if (stock === null) {
                //Si no existe lo creamos con la cantidad inicial del ingreso
                stock = await Stock.create({
                    'product': product.id,
                    'sucursal': sucursal.id,
                    'cant': data.cant,
                    'reserved': 0,
                }, { 'transaction': t });

            } else {
                last_sucursal_stock = stock.cant;
                stock.cant += data.cant;
                await stock.save({ 'transaction': t });
            }
            //calcular el costo promedio y actualizar el registro del producto
            let last_cost = product.cost;
            let last_stock = product.stock;

            product.cost = ((last_cost * last_stock) + (data.cant * data.cost)) / (data.cant + last_stock);
            product.stock += data.cant;
            product.last_cost = last_cost;

            await product.save({ transaction: t });

            //registrar el movimiento
            let move = await Movement.create({
                last_sucursal_stock: last_sucursal_stock,
                last_product_stock: last_stock,
                cant: data.cant,
                cost: data.cost,
                last_cost: last_cost,
                in: true,
                product: product.id,
                concept: data.concept,
                sucursal: sucursal.id,
                createdBy: req.session.userSession.shortName,
            }, { transaction: t });

            await t.commit();
            res.json({
                status: 'success',
                data: product.id,
            });
        } catch (error) {
            console.log(error);
            await t.rollback();
            return res.status(500).json({ 'error': 'Internal Server Error' });
        }

    },
    out: async (req, res) => {
        //Producto
        let product = await Product.findByPk(req.params.id);
        if (product === null) {
            return res.status(404);
        }

        //Sucursal
        let temp = await Sucursal.findAll({
            attributes: ['id', 'name']
        });

        //indexar sucursales
        let sucursals = [];

        temp.forEach(element => {
            sucursals[element.id] = {
                'name': element.name,
                'id': element.id,
                'stock': 0,
            };
        });

        //Existencias
        let stock = await Stock.findAll(
            { where: { product: req.params.id } }
        );

        //indexar las existencias
        stock.forEach(element => sucursals[element.sucursal].stock = (element.cant - element.reserved));

        res.render('Inventory/Product/out', {
            product,
            pageTitle: product.name,
            sucursals,
        });

    },
    SaveOut: async (req, res) => {
        const t = await sequelize.transaction();
        try {
            let data = req.body;
            let product = await Product.findByPk(req.params.id);
            if (product === null) {
                return res.status(404).json({
                    status: 'errorMessage',
                    message: 'Producto no encontrado',
                });
            }

            //comprobar la sucursal
            let sucursal = await Sucursal.findByPk(data.sucursal);
            if (sucursal === null) {
                return res.status(404).json({
                    status: 'errorMessage',
                    message: 'la sucursal seleccionada no es correcta',
                });
            }

            data.cant = Number.parseInt(data.cant);

            let error = null;
            if (data.concept.length < 10) {
                error = 'Proporcione una justificación de al menos 10 caracteres';
            } else if (data.cant < 1) {
                error = 'Ingrese una cantidad válida';
            }

            if (error !== null) {
                return res.json({
                    status: 'errorMessage',
                    message: message,
                });
            }
            //Compriobar si hay stocks creados en esa sucursal
            let stock = await Stock.findOne({
                where: {
                    [Op.and]: [
                        { 'product': req.params.id },
                        { 'sucursal': data.sucursal }
                    ],
                }
            });

            if (stock === null) {
                return res.status(404).json({
                    status: 'errorMessage',
                    message: 'Existencias no Disponibles',
                });
            }

            //validar la cantidad existente en el Stock de la sucursal Seleccionada

            if (stock.cant - stock.reserved >= data.cant) {
                let move = await Movement.create({
                    last_sucursal_stock: stock.cant,
                    last_product_stock: product.stock,
                    cant: data.cant,
                    cost: product.cost,
                    last_cost: product.cost,
                    in: false,
                    product: product.id,
                    concept: data.concept,
                    sucursal: sucursal.id,
                    createdBy: req.session.userSession.shortName,
                }, { transaction: t });


                //Actualizar el Stock
                stock.cant -= data.cant;
                await stock.save({ 'transaction': t });

                //Actualizar el producto
                product.stock -= data.cant;
                await product.save({ transaction: t });

                await t.commit();
                res.json({
                    status: 'success',
                    data: product.id,
                });
            } else {
                return res.status(404).json({
                    status: 'errorMessage',
                    message: 'No puedes sacar una cantidad mayor a la cantidad disponible',
                });
            }

            //Registrar el movimiento

        } catch (error) {
            console.log(error);
            await t.rollback();
            return res.status(500).json({ 'error': 'Internal Server Error' });
        }

    },
    move: async (req, res) => {
        let product = await Product.findByPk(req.params.id);
        if (product === null) {
            return res.status(404);
        }

        let sucursal = await Sucursal.findAll({ attributes: ['id', 'name'] });
        res.render('Inventory/Product/move', {
            product,
            pageTitle: product.name,
            sucursal
        });

    },
    moveDetails: async (req, res) => {
        let product = await Product.findByPk(req.params.id);
        if (product === null) {
            return res.status(404);
        }

        let init = req.query.init;
        let end = req.query.end;
        let sucursal = req.query.sucursal;

        //buscar los detalles 
        let details = await Movement.findAll({
            where: {
                [Op.and]: [
                    { product: product.id },
                    { sucursal: sucursal },
                    { createdAt: { [Op.between]: [init, end], } }
                ],
            }
        });

        // verificar si hay movimeintos

        if (details.length > 0) {
            //obtener el primer detalle
            let first = details[0];
            first = [{
                'number': 1,
                'date': Helper.format_date(init),
                'concept': 'Saldo Inicial a la fecha',
                'in_cant': '',
                'out_cant': '',
                'cant': first.last_sucursal_stock,
            }]

            let numb = 1;
            details = details.map(element => {
                numb++;
                if (element.in) {
                    // Si el movimeinto es una entrada entonces calculemos el costo promedio
                    let cant = (element.cant + element.last_sucursal_stock);

                    return {
                        'number': numb,
                        'date': Helper.format_date(element.createdAt),
                        'concept': element.concept,
                        'in_cant': element.cant,
                        'out_cant': '',
                        'cant': cant,
                    }
                } else {

                    return {
                        'number': numb,
                        'date': Helper.format_date(element.createdAt),
                        'concept': element.concept,
                        'in_cant': '',
                        'out_cant': element.cant,
                        'cant': (element.last_sucursal_stock - element.cant),
                    }
                }
            });

            details = first.concat(details);
            return res.json(details);
        }

        return res.json({
            details: [],
        })
    },
    viewInStock: async (req, res) => {
        let sucursals = await Sucursal.findAll();
        res.render('Inventory/Product/inStock', { pageTitle: 'Productos disponibles', limit: 10, sucursals });
    },
    productInStock: async (req, res) => {
        let search = req.query.search;
        let sucursal = req.query.sucursal;
        let offset = Number.parseInt(req.query.offset);
        let limit = 10;
        let products = [];

        if (search === undefined) {
            // products = await sequelize.query(
            //     'SELECT * FROM `inventory_product` where id < 100 order by name ASC Limit :offset,:limit ',
            //     {
            //         replacements: { offset: offset, limit: limit },
            //         type: QueryTypes.SELECT
            //     }
            // );
            let sql = sucursal !== undefined ? `SELECT * FROM inventory_product WHERE id in (SELECT DISTINCT(product) FROM inventory_product_stock where cant > 0 and cant > reserved and sucursal = ${sucursal}) order by name ASC Limit :offset,:limit ` : `SELECT * FROM inventory_product WHERE id in (SELECT DISTINCT(product) FROM inventory_product_stock where cant > 0 and cant > reserved) order by name ASC Limit :offset,:limit`;

            products = await sequelize.query(
                sql,
                {
                    replacements: { offset: offset, limit: limit },
                    type: QueryTypes.SELECT
                }
            );
        } else {

            // products = await sequelize.query(
            //     "SELECT * FROM `inventory_product` WHERE name like :search or internal_code like :search order by name ASC Limit :offset,:limit ",
            //     {
            //         replacements: { search: `%${search}%`,offset: offset, limit: limit, },
            //         type: QueryTypes.SELECT
            //     }
            // );
            let sql = sucursal !== undefined ? `SELECT * FROM inventory_product WHERE (name like :search or internal_code like :search) and id in (SELECT DISTINCT(product) FROM inventory_product_stock where cant > 0 and cant > reserved and sucursal = ${sucursal}) order by name ASC Limit :offset,:limit` : "SELECT * FROM `inventory_product` WHERE (name like :search or internal_code like :search) and id in (SELECT DISTINCT(product) FROM `inventory_product_stock` where cant > 0 and cant > reserved) order by name ASC Limit :offset,:limit";

            products = await sequelize.query(
                sql,
                {
                    replacements: { search: `%${search}%`, offset: offset, limit: limit, },
                    type: QueryTypes.SELECT
                }
            );
        }

        //Obtener los Ids en un array
        let ids = products.map(prod => {
            return prod.id;
        });

        //obtener los stock
        let tmp = [];
        if (sucursal !== undefined) {
            tmp = await Stock.findAll({
                where: {
                    [Op.and]: {
                        product: { [Op.in]: ids },
                        cant: { [Op.gt]: 0 },
                        sucursal: sucursal
                    }
                }
            });
        } else {
            tmp = await Stock.findAll({
                where: {
                    [Op.and]: {
                        product: { [Op.in]: ids },
                        cant: { [Op.gt]: 0 }
                    }
                }
            });
        }


        //indexar los resultados
        let stocks = {};
        tmp.forEach(stock => {
            if (stocks[stock.product] === undefined) {
                stocks[stock.product] = { 'reserved': 0, stock: [], sum: 0 };
            }
            stocks[stock.product].stock.push(stock);
            stocks[stock.product].reserved += stock.reserved;
            stocks[stock.product].sum += stock.cant;
        })

        //Indexar los productos

        products = products.map(prod => {
            return stocks[prod.id] === undefined ?
                {
                    id: prod.id,
                    cant: prod.stock,
                    sku: prod.internal_code,
                    sum: 0,
                    reserved: 0,
                    stocks: [],
                    name: prod.name,
                    price: prod.base_price,
                    major: prod.major_price,
                    image: prod.image !== null ? (prod.image.includes('http') ? prod.image : `/upload/images/${prod.image}`) : '/upload/images/image-not-found.png',
                } : {
                    id: prod.id,
                    cant: prod.stock,
                    sku: prod.internal_code,
                    reserved: stocks[prod.id].reserved,
                    sum: stocks[prod.id].sum,
                    stocks: stocks[prod.id].stock,
                    name: prod.name,
                    price: prod.base_price,
                    major: prod.major_price,
                    image: prod.image !== null ? (prod.image.includes('http') ? prod.image : `/upload/images/${prod.image}`) : '/upload/images/image-not-found.png',
                };
        });
        //enviar los productos
        return res.json(products);
    },
    divideProductView: async (req, res) => {
        let sucursals = await Sucursal.findAll({ attributes: ['id', 'name'] })
        res.render('Inventory/Product/divide', {
            pageTitle: 'Dividir Productos', sucursals
        });
    },
    divideProduct: async (req, res) => {
        var data = req.body;
        var origin = await Product.findByPk(data.origin);
        if (origin == null) { return Helper.notFound(req, res, 'Product not Found'); }

        var cant = Number.parseInt(data.cant),
            ids = [],
            products = {},
            stocks = {},
            largo = data.dt.length,
            percent = 0,
            sucursal = await Sucursal.findByPk(data.sucursal),
            origin_stock = await Stock.findOne({
                where: {
                    [Op.and]: [
                        { 'product': origin.id },
                        { 'sucursal': data.sucursal }
                    ],
                }
            });

        if (sucursal == null) {
            return Helper.notFound(req, res, 'Sucursal not Found')
        } else if (!origin_stock) {
            return res.json({ status: 'errorMessage', message: 'Existencias del producto no encontradas' });
        }

        cant = cant > (origin_stock.cant - origin_stock.reserved) ? (origin_stock.cant - origin_stock.reserved) : cant;

        if (largo < 2) {
            return res.json({ status: 'errorMessage', message: 'Debe Seleccionar al menos dos productos para realizar una Unión de productos' });
        } else if (cant < 1) {
            return res.json({ status: 'errorMessage', message: 'La cantidad Mínima del producto dividido debe ser uno' });
        }


        //recorrer los detalles y obtener la lista de id de los productos e indexarlos de una vez
        data.dt.forEach(dt => {
            ids.push(dt.id);
            percent += Number.parseFloat(dt.percent);
        });

        if (percent < 100) {
            return res.json({ status: 'errorMessage', message: 'Complete el 100% del producto' });
        }

        //buscar e indexar los productos
        let tmp = await Product.findAll({ where: { id: { [Op.in]: ids, } } });
        if (tmp.length < largo) { return res.json({ status: 'errorMessage', message: 'Productos a resultantes no encontrados' }); }
        tmp.forEach(prod => products[prod.id] = prod);

        //Buscar e Indexar los Stock
        tmp = await Stock.findAll({
            where: {
                product: { [Op.in]: ids },
                sucursal: sucursal.id,
            }
        });

        tmp.forEach(stock => { stocks[stock.product] = stock; });

        var concept = `Division de ${cant} unidades del Kit/set ${origin.name} (SKU#${origin.internal_code})`;

        try {
            const result = await sequelize.transaction(async (t) => {
                //movimiento de salida
                //registrar el movimento de salida
                let move = await Movement.create({
                    last_sucursal_stock: origin_stock.cant,
                    last_product_stock: origin.stock,
                    cant: cant,
                    cost: origin.cost,
                    last_cost: origin.cost,
                    in: false,
                    product: origin.id,
                    concept: 'Separacion de este producto en productos mas pequeños',
                    sucursal: sucursal.id,
                    createdBy: req.session.userSession.shortName,
                }, { transaction: t });


                //Actualizar el Stock
                origin_stock.cant -= cant;
                await origin_stock.save({ 'transaction': t });

                //Actualizar el producto
                origin.stock -= cant;
                await origin.save({ transaction: t });

                //recorrer los detalles y realizar los registros de salida de cada uno de ellos y actualizar el registro del producto
                for (let index = 0; index < largo; index++) {
                    let dt_cant = Number.parseInt(data.dt[index].cant),
                        //costo = costo del producto dividido * el porcentaje del detalle/ la cantidad del detalle * 100
                        dt_cost = Number.parseFloat((origin.cost * data.dt[index].percent) / (100 * dt_cant)),
                        prod = products[data.dt[index].id],
                        in_cant = dt_cant * cant,
                        stock = stocks[data.dt[index].id];
                    //Si el stock existe, aumentamos la cantidad existente

                    console.log(stock);
                    let last_sucursal_stock = 0;
                    if (stock === null || stock === undefined) {
                        //Si no existe lo creamos con la cantidad inicial del ingreso
                        stock = await Stock.create({
                            'product': prod.id,
                            'sucursal': sucursal.id,
                            'cant': in_cant,
                            'reserved': 0,
                        }, { 'transaction': t });
                    } else {
                        last_sucursal_stock = stock.cant;
                        stock.cant += in_cant;
                        await stock.save({ 'transaction': t });
                    }
                    //calcular el costo promedio y actualizar el registro del producto
                    let last_cost = prod.cost;
                    let last_stock = prod.stock;
                    prod.cost = ((last_cost * last_stock) + (in_cant * dt_cost)) / (in_cant + last_stock);
                    prod.stock += in_cant;
                    prod.last_cost = last_cost;

                    await prod.save({ transaction: t });

                    //registrar el movimiento
                    let move = await Movement.create({
                        last_sucursal_stock: last_sucursal_stock,
                        last_product_stock: last_stock,
                        cant: in_cant,
                        cost: dt_cost,
                        last_cost: last_cost,
                        in: true,
                        product: prod.id,
                        concept: concept,
                        sucursal: sucursal.id,
                        createdBy: req.session.userSession.shortName,
                    }, { transaction: t });
                }

                //transaction commit
                return res.json({
                    status: 'success',
                    data: origin.id,
                });

            });

        } catch (error) {
            console.log(error);
            return res.status(500).json({ 'error': 'Internal Server Error' });
        }


    },
    joinProductView: async (req, res) => {
        let sucursals = await Sucursal.findAll({ attributes: ['id', 'name'] })
        res.render('Inventory/Product/join', {
            pageTitle: 'Unir Productos',
            sucursals,
        });
    },
    joinProduct: async (req, res) => {

        var data = req.body;

        console.log(data.destino);
        var destino = await Product.findByPk(data.destino);
        if (destino == null) { return Helper.notFound(req, res, 'Product not Found'); }

        var acumulated_cost = 0.00,
            cant = Number.parseInt(data.cant),
            ids = [],
            products = {},
            stocks = {},
            maxs = {},
            current_max = null,
            largo = data.dt.length,
            sucursal = await Sucursal.findByPk(data.sucursal);


        if (sucursal == null) {
            return Helper.notFound(req, res, 'Sucursal not Found')
        } else if (largo < 2) {
            return res.json({ status: 'errorMessage', message: 'Debe Seleccionar al menos dos productos para realizar una Unión de productos' });
        } else if (cant < 1) {
            return res.json({ status: 'errorMessage', message: 'La cantidad Mínima del producto resultante debe ser uno' });
        }


        //recorrer los detalles y obtener la lista de id de los productos e indexarlos de una vez
        data.dt.forEach(prod => {
            ids.push(prod.id);
            maxs[prod.id] = Number.parseInt(prod.cant);
        });

        //buscar e indexar los productos
        let tmp = await Product.findAll({ where: { id: { [Op.in]: ids, } } });
        if (tmp.length < largo) { return res.json({ status: 'errorMessage', message: 'Productos a Unir no encontrados' }); }
        tmp.forEach(prod => products[prod.id] = prod);

        //Buscar e Indexar los Stock
        tmp = await Stock.findAll({
            where: {
                product: { [Op.in]: ids },
                sucursal: sucursal.id,
            }
        });
        if (tmp.length < largo) { return res.json({ status: 'errorMessage', message: 'Productos a Unir no encontrados' }); }
        tmp.forEach(stock => {
            stocks[stock.product] = stock;
            let max = stock.cant - stock.reserved / maxs[stock.product];
            current_max = current_max == null ? max : (max > current_max ? current_max : max);
        });

        if (current_max < cant) { return res.json({ status: 'errorMessage', message: `La Cantidad maxima producible es ${current_max} de acuerdo a los productos de origen seleccionados` }); }


        var concept = `fabricacion de ${cant} del Kit/set ${destino.name} (SKU#${destino.internal_code})`;

        try {
            const result = await sequelize.transaction(async (t) => {
                //recorrer los detalles y realizar los registros de salida de cada uno de ellos y actualizar el registro del producto
                for (let index = 0; index < largo; index++) {
                    let dt_cant = Number.parseInt(data.dt[index].cant),
                        prod = products[data.dt[index].id],
                        stock = stocks[data.dt[index].id];

                    //registrar el movimento de salida
                    let move = await Movement.create({
                        last_sucursal_stock: stock.cant,
                        last_product_stock: prod.stock,
                        cant: dt_cant * cant,
                        cost: prod.cost,
                        last_cost: prod.cost,
                        in: false,
                        product: prod.id,
                        concept: concept,
                        sucursal: sucursal.id,
                        createdBy: req.session.userSession.shortName,
                    }, { transaction: t });


                    //Actualizar el Stock
                    stock.cant -= dt_cant * cant;
                    await stock.save({ 'transaction': t });

                    //Actualizar el producto
                    prod.stock -= dt_cant * cant;
                    await prod.save({ transaction: t });

                    //sumar el costo
                    acumulated_cost += Number.parseFloat(prod.cost * dt_cant);
                }

                //registrar el movimiento de ingreso para el propducto resultante, actualizar el stock y el registro del producto
                //Compriobar si hay stocks creados en esa sucursal
                let destino_stock = await Stock.findOne({
                    where: {
                        [Op.and]: [
                            { 'product': destino.id },
                            { 'sucursal': sucursal.id }
                        ],
                    }
                });
                //Si el stock existe, aumentamos la cantidad existente
                let last_sucursal_stock = 0;
                if (destino_stock === null) {
                    //Si no existe lo creamos con la cantidad inicial del ingreso
                    destino_stock = await Stock.create({
                        'product': destino.id,
                        'sucursal': sucursal.id,
                        'cant': cant,
                        'reserved': 0,
                    }, { 'transaction': t });

                } else {
                    last_sucursal_stock = destino_stock.cant;
                    destino_stock.cant += data.cant;
                    await destino_stock.save({ 'transaction': t });
                }


                //calcular el costo promedio y actualizar el registro del producto
                let last_cost = destino.cost;
                let last_stock = destino.stock;

                destino.cost = ((last_cost * last_stock) + (cant * acumulated_cost)) / (cant + last_stock);
                destino.stock += cant;
                destino.last_cost = last_cost;

                await destino.save({ transaction: t });

                //registrar el movimiento
                let move = await Movement.create({
                    last_sucursal_stock: last_sucursal_stock,
                    last_product_stock: last_stock,
                    cant: cant,
                    cost: acumulated_cost,
                    last_cost: last_cost,
                    in: true,
                    product: destino.id,
                    concept: 'Unión de Productos para elaboración de este KIT/SET',
                    sucursal: sucursal.id,
                    createdBy: req.session.userSession.shortName,
                }, { transaction: t });


                //transaction commit
                return res.json({
                    status: 'success',
                    data: destino.id,
                });

            });

        } catch (error) {
            console.log(error);
            return res.status(500).json({ 'error': 'Internal Server Error' });
        }
    },




    getRecountView: async (req, res) => {
        //buscar a ver si hay procesos de Inventario Fisico e indexarlos para separar abiertos de cerrados
        let finished = [], in_process = [], sucursal = [], indexedSucursal = {};
        let tmp = await Sucursal.findAll({ attributes: ['id', 'name'] });
        tmp.forEach(el => {
            indexedSucursal[el.id] = el.name;
            sucursal.push({ id: el.id, name: el.name });
        });

        tmp = await Recount.findAll();
        tmp.forEach(el => el.endBy === null ? in_process.push(el) : finished.push(el));

        res.render('Inventory/Stock/recounts', {
            pageTitle: 'Inventario físico',
            finished,
            sucursal,
            indexedSucursal,
            in_process
        });
    },

    createNewRecount: async (req, res) => {
        let data = req.body;
        let exist = await Recount.findOne({
            where: {
                endBy: { [Op.is]: null },
                sucursal: data.sucursal
            }
        });

        if (exist !== null) {
            return res.json({
                status: 'success',
                data: exist.id,
            });
        }

        const t = await sequelize.transaction();
        try {

            var process = await Recount.create({
                sucursal: data.sucursal,
                createdBy: req.session.userSession.shortName,
            }, { transaction: t });


            //crear las areas
            let stocks = await Stock.findAll({
                where: {
                    sucursal: data.sucursal,
                    cant: { [Op.gt]: 0 }
                }
            });

            if (stocks.length > 0) {
                let products = {};
                let tmp = await sequelize.query(
                    'SELECT * FROM `inventory_product` WHERE id in (SELECT DISTINCT(product) FROM `inventory_product_stock` where cant > 0 and sucursal = :sucursal)',
                    {
                        replacements: { sucursal: data.sucursal },
                        type: QueryTypes.SELECT
                    }
                );
                tmp.forEach(prod => products[prod.id] = prod);
                let details = stocks.map(el => {
                    return {
                        recount: process.id,
                        product: el.product,
                        product_name: products[el.product].name,
                        sku: products[el.product].internal_code,
                        initial: el.cant,
                        final: 0,
                        cost: products[el.product].cost,
                    };
                });

                details = await RecountDetail.bulkCreate(details, { transaction: t });
            }

            await t.commit();
            return res.json({
                status: 'success',
                data: process.id,
            });
        } catch (error) {
            console.log(error);
            await t.rollback();
            return res.status(500).json({ data: error, 'error': 'Internal Server Error' });
        }
    },

    viewRecount: async (req, res) => {
        //Buscar el proceso
        let recount = await Recount.findByPk(req.params.id);
        if (recount === null) {
            return res.status(404).send('Not Found');
        }
        let areas = await RecountArea.findAll({ where: { recount: req.params.id } });
        let tmp = await RecountDetail.findAll({ where: { recount: req.params.id } });
        let sucursal = await Sucursal.findByPk(recount.sucursal);

        if (recount.endBy != null) {
            let details = tmp;
            return res.render('Inventory/Stock/recountReport', {
                recount,
                pageTitle: 'Inventario Fisico',
                sucursal,
                details,
            });
        }
        let details = { revised: [], pending: [] };
        tmp.forEach(detail => detail.revised_by === null ? details.pending.push(detail) : details.revised.push(detail));
        return res.render('Inventory/Stock/recount', {
            recount,
            pageTitle: 'Inventario Fisico',
            sucursal,
            details,
            areas
        });

    },

    updateRecount: async (req, res) => {
        //buscar el recount
        let recount = await Recount.findByPk(req.body.id);
        if (recount === null) {
            return res.json({
                status: 'errorMessage',
                data: 'El proceso que intenta acutalizar no existe',
            });
        } else if (recount.endBy !== null) {
            return res.json({
                status: 'errorMessage',
                data: 'El proceso que intenta acutalizar ya esta finalizado',
            });
        }

        if (req.body.case === 'finish') {
            //Buscar los detalles que aun no esten verificados



            let count = await RecountDetail.count({ where: { recount: recount.id, revised_by: { [Op.is]: null, } } });
            if (count > 0) {
                return res.json({
                    status: 'warning',
                    data: 'Aun tienes detalles sin verificar',
                });
            }

            //Si no hay detalles no verificados buscar los detalles del recuento
            var details = await RecountDetail.count({ where: { recount: recount.id } });

            if (details < 1) {
                return res.json({
                    status: 'warning',
                    data: 'Est proceso no tiene ningun detalle para ser finalizado',
                });
            }
            var details = await RecountDetail.findAll({ where: { recount: recount.id } });
            //buscar los productos e Indexarlos
            var products = {};
            var tmp = await sequelize.query(
                'SELECT * FROM `inventory_product` WHERE id in (SELECT DISTINCT(product) FROM `inventory_recount_detail` where recount = :recount)',
                {
                    replacements: { recount: recount.id },
                    type: QueryTypes.SELECT,
                    model: Product,
                }
            );
            //Indexar los productos
            tmp.forEach(prod => products[prod.id] = prod);

            //buscar los stock e indexarlos
            tmp = await sequelize.query(
                'SELECT * FROM `inventory_product_stock` WHERE product in (SELECT product FROM inventory_recount_detail where recount = :recount) and sucursal = :sucursal;',
                {
                    replacements: { recount: recount.id, sucursal: recount.sucursal },
                    type: QueryTypes.SELECT,
                    model: Stock,
                }
            );

            var _stocks = {};
            tmp.forEach(st => _stocks[st.product] = st);

            try {

                const result = await sequelize.transaction(async (t) => {
                    for (let index = 0; index < details.length; index++) {
                        let detail = details[index];
                        console.log(`detalle # ${index}`)

                        let st = _stocks[detail.product];
                        if (st == undefined || st == null) {
                            st = await Stock.create({
                                product: detail.product,
                                sucursal: recount.sucursal,
                                cant: 0,
                                reserved: 0,
                            });
                        }
                        let prod = products[detail.product];
                        let cant = 0;

                        if (st.cant > detail.final) {
                            //Registrar un movimeinto de salida
                            //NOTA: en este caso si o si debe de haber un stock relacionado

                            //determinar el costo del producto
                            cant = st.cant - detail.final;
                            //registrar el movimiento
                            let move = await Movement.create({
                                last_sucursal_stock: st.cant,
                                last_product_stock: prod.stock,
                                cant: cant,
                                cost: prod.cost,
                                last_cost: prod.cost,
                                in: false,
                                product: prod.id,
                                concept: `Inventario Físico id ${recount.id}. ${detail.observation}`,
                                sucursal: recount.sucursal,
                                createdBy: req.session.userSession.shortName,
                            }, { transaction: t });

                            //Actualizar el Stock
                            st.cant -= cant;
                            await st.save({ transaction: t });

                            //Actualizar el producto

                            prod.stock -= cant;
                            await prod.save({ transaction: t });

                        } else if (st.cant < detail.final) {
                            //Registrar un movimeinto de ingreso
                            //determinar el costo del producto
                            let cost = prod.cost > 0.00 ? prod.cost : detail.cost;
                            //determinar si el stock existe
                            console.log(st)
                            if (st == undefined) {
                                st = await Stock.create({
                                    product: detail.product,
                                    sucursal: recount.sucursal,
                                    cant: 0,
                                    reserved: 0,
                                }, { transaction: t });
                            }

                            cant = detail.final - st.cant;
                            //registrar el movimiento
                            let move = await Movement.create({
                                last_sucursal_stock: st.cant,
                                last_product_stock: prod.stock,
                                cant: cant,
                                cost: cost,
                                last_cost: prod.cost,
                                in: true,
                                product: prod.id,
                                concept: `Inventario Físico id ${recount.id}. ${detail.observation}`,
                                sucursal: recount.sucursal,
                                createdBy: req.session.userSession.shortName,
                            }, { transaction: t });

                            //Actualizar el Stock
                            st.cant += cant;
                            await st.save({ transaction: t });

                            //Actualizar el producto
                            let new_cost = (prod.cost * prod.stock) + (cant * cost);

                            prod.last_cost = prod.cost;
                            prod.stock += cant;
                            prod.cost = Number.parseFloat(new_cost / prod.stock);
                            await prod.save({ transaction: t });

                        }
                    }

                    //finalizar el proceso
                    recount.endBy = req.session.userSession.shortName;
                    recount.endComment = req.body.observation;
                    let _date = new Date();

                    recount.end_date = _date.toISOString();
                    await recount.save({ transaction: t });

                    //transaction commit
                    return res.json({
                        status: 'success',
                        data: recount.id,
                    });

                });

            } catch (error) {
                console.log(error);
                return res.status(500).json({ 'error': 'Internal Server Error' });

            }


        }
        else if (req.body.case === 'verification') {
            let detail = await RecountDetail.findByPk(req.body.detail);
            if (detail == null) {
                return res.json({
                    status: 'errorMessage',
                    data: 'Dato Incorrecto',
                });
            }

            cant = Number.parseInt(req.body.cant);
            if (detail.initial > cant) {
                //buscar el stock y verificar que la cantidad final sea mayor a la cantidad disponible
                let _stock = await Stock.findOne({
                    where: {
                        sucursal: recount.sucursal,
                        product: detail.product
                    }
                });

                let disponible = (_stock.cant - _stock.reserved);
                if (disponible < (detail.initial - cant)) {
                    return res.json({
                        _data: {
                            disponible,
                            _stock,
                            dif: detail.initial - cant,
                        },
                        status: 'errorMessage',
                        data: 'Tienes reservada una cantidad mayor, por favor resuelve las reservas antes de ajustar el inventario',
                    });
                }
            }

            if (detail.initial === cant) {
                detail.final = detail.initial;
            } else {
                detail.final = cant;
                detail.observation = req.body.observation;
            }
            detail.revised_by = req.session.userSession.shortName;
            await detail.save();

            return res.json({
                status: 'success',
            });

        } else {

            //Verificar Si no existe el detalle
            let detail = await RecountDetail.findOne({
                where: {
                    recount: req.body.id,
                    product: req.body.product
                }
            });

            let product = await Product.findByPk(req.body.product);
            if (product === null) {
                return res.json({
                    status: 'errorMessage',
                    data: 'El producto seleccionado no existe',
                });
            }

            if (detail == null) {
                //Si no existe crearlo 
                detail = await RecountDetail.create({
                    recount: req.body.id,
                    product: product.id,
                    product_name: product.name,
                    sku: product.internal_code,
                    initial: 0,
                    final: req.body.cant,
                    observation: req.body.observation,
                    revised_by: req.session.userSession.shortName,
                    cost: req.body.cost
                });

                return res.json({
                    status: 'success',
                    detail: detail,
                    product: product,
                });
            }

            detail.final = req.body.cant;
            detail.observation = req.body.observation;
            detail.revised_by = req.session.userSession.shortName;

            if (detail.initial == 0) { detail.cost = req.body.cost; }

            await detail.save();

            return res.json({
                status: 'warning',
                data: detail,
            });
        }
    },

    cleanRecount: async (req, res) => {
        //buscar el recount
        let recount = await Recount.findByPk(req.body.id);
        if (recount === null) {
            return res.json({
                status: 'errorMessage',
                data: 'El proceso que intenta acutalizar no existe',
            });
        } else if (recount.endBy !== null) {
            return res.json({
                status: 'errorMessage',
                data: 'El proceso que intenta acutalizar ya esta finalizado',
            });
        }

        //obtener los detalles
        let tmp = await RecountDetail.findAll({
            where: {
                recount: recount.id
            }
        });
        let details = {};
        tmp.forEach(detail => details[detail.product] = detail);

        //obtener los stock
        tmp = await sequelize.query(
            `SELECT * FROM inventory_product_stock WHERE sucursal = ${recount.sucursal}`,
            { model: Stock }
        );
        //recorrer los stock 


        try {
            let largo = tmp.length;
            return await sequelize.transaction(async (t) => {

                for (let index = 0; index < largo; index++) {
                    let stock = tmp[index];
                    let detail = details[stock.product];
                    if (detail !== undefined && detail !== null) {
                        if ((stock.cant == 0 && detail.initial > 0)) {
                            detail.initial = 0;
                            detail.revised_by = null;
                            detail.observation = null;
                            await detail.save({ transaction: t });
                        }
                        if (stock.cant > 0 && stock.cant != detail.initial) {
                            detail.initial = stock.cant;
                            detail.revised_by = null;
                            detail.observation = null;
                            await detail.save({ transaction: t });
                        }
                    } else {
                        if (stock.cant > 0) {

                            let product = await Product.findByPk(stock.product);

                            detail = await RecountDetail.create({
                                recount: recount.id,
                                product: stock.product,
                                product_name: product.name,
                                sku: product.internal_code,
                                initial: stock.cant,
                                final: stock.cant,
                                observation: null,
                                revised_by: null,
                                cost: product.cost
                            }, { transaction: t });

                        }
                    }
                }

                return res.json({ status: 'success', message: 'Detalles agregados a la solicitud en curso. ¡Redirigiendo!' });
            });

        } catch (error) {
            console.log(error);
            return res.json({ status: 'error', message: 'Detalles agregados a la solicitud en curso. ¡Redirigiendo!', error });
        }
    },


    addAreas: async (req, res) => {
        let recount = await Recount.findByPk(req.body.id);
        if (recount === null) {
            return res.json({
                status: 'errorMessage',
                data: 'El proceso que intenta acutalizar no existe',
            });
        } else if (recount.endBy !== null) {
            return res.json({
                status: 'errorMessage',
                data: 'El proceso que intenta acutalizar ya esta finalizado',
            });
        }


        let area = await RecountArea.create({
            recount: recount.id, name: req.body.name
        });

        return res.json({
            status: 'success',
            data: area.id,
        });
    },

    viewArea: async (req, res) => {
        let area = await RecountArea.findByPk(req.params.id);
        let recount = await Recount.findByPk(area.recount);

        if (area === null) {
            return res.status(404).send('Not Found');
        }

        let details = await RecountAreaDetail.findAll({ where: { area: req.params.id } });
        let sucursal = await Sucursal.findByPk(recount.sucursal);
        let tmp = await Product.findAll({ where: { id: { [Op.in]: sequelize.literal(`(SELECT product FROM inventory_recount_area_detail WHERE area = ${area.id})`) } } });

        let products = {};
        tmp.forEach(element => products[element.id] = element);

        return res.render(recount.endBy != null || area._status == true ? 'Inventory/Stock/closedRecountArea' : 'Inventory/Stock/recountArea', {
            area,
            pageTitle: 'Inventario Fisico',
            sucursal,
            details,
            recount,
            products
        });
    },

    addDetailToArea: async (req, res) => {

        try {
            return await sequelize.transaction(async (t) => {
                let _cant = Number.parseInt(req.body.cant);
                if (req.body.case == 'add') {
                    let area = await RecountArea.findByPk(req.body.area);
                    if (area == null) {
                        return res.json({
                            status: 'errorMessage',
                            message: 'El area seleccionada no existe'
                        });
                    }

                    let detail = await RecountAreaDetail.findOne({
                        where: {
                            area: req.body.area,
                            product: req.body.product
                        }
                    });

                    if (detail != null) {

                        detail.cant = detail.cant + _cant;
                        await detail.save({ transaction: t });


                        let recountDetail = await RecountDetail.findOne({
                            where: {
                                recount: area.recount,
                                product: req.body.product
                            }
                        });

                        recountDetail.final = recountDetail.final + _cant;
                        if (recountDetail.final == recountDetail.initial) {
                            recountDetail.revised_by = "Sumatoria Sistema";
                        } else {
                            recountDetail.revised_by = null;
                        }
                        await recountDetail.save({ transaction: t });




                    } else {

                        detail = await RecountAreaDetail.create({
                            area: req.body.area,
                            product: req.body.product,
                            cant: _cant,
                            createdBy: req.session.userSession.shortName,
                        }, { transaction: t });

                        let recountDetail = await RecountDetail.findOne({
                            where: {
                                recount: area.recount,
                                product: req.body.product
                            }
                        });

                        if (recountDetail == null) {
                            let recount = await Recount.findByPk(area.recount);
                            let stock = await Stock.findOne({
                                where: {
                                    sucursal: recount.sucursal,
                                    product: req.body.product
                                }
                            });

                            let product = await Product.findByPk(req.body.product);

                            if (stock) {
                                recountDetail = await RecountDetail.create({
                                    recount: area.recount,
                                    product: stock.product,
                                    product_name: product.name,
                                    sku: product.internal_code,
                                    initial: stock.cant,
                                    final: _cant,
                                    observation: null,
                                    revised_by: stock.cant == _cant ? 'Sumatoria Sistema' : null,
                                    cost: product.cost
                                }, { transaction: t });
                            } else {
                                recountDetail = await RecountDetail.create({
                                    recount: area.recount,
                                    product: product.id,
                                    product_name: product.name,
                                    sku: product.internal_code,
                                    initial: 0,
                                    final: _cant,
                                    observation: null,
                                    revised_by: null,
                                    cost: product.cost
                                }, { transaction: t });
                            }

                        } else {
                            recountDetail.final = recountDetail.final + _cant;
                            if (recountDetail.final == recountDetail.initial) {
                                recountDetail.revised_by = "Sumatoria Sistema";
                            }
                            await recountDetail.save({ transaction: t });
                        }

                    }



                    return res.json({
                        status: 'success',
                        data: detail
                    });

                } else if (req.body.case == 'update') {
                    let detail = await RecountAreaDetail.findByPk(req.body.detail);
                    if (detail == null) {
                        return res.json({
                            status: 'errorMessage',
                            message: 'Detalle no encontrado'
                        });
                    }

                    let area = await RecountArea.findByPk(detail.area);
                    let recountDetail = await RecountDetail.findOne({
                        where: {
                            recount: area.recount,
                            product: detail.product
                        }
                    });

                    recountDetail.final = (recountDetail.final - detail.cant) + _cant;


                    if (recountDetail.final == recountDetail.initial) {
                        recountDetail.revised_by = "Sumatoria Sistema";
                    } else {
                        recountDetail.revised_by = null;
                    }
                    await recountDetail.save({ transaction: t });

                    detail.cant = _cant;
                    await detail.save({ transaction: t });

                    return res.json({
                        status: 'success',
                        data: detail
                    });

                } else if (req.body.case == 'delete') {
                    let detail = await RecountAreaDetail.findByPk(req.body.detail);
                    if (detail == null) {
                        return res.json({
                            status: 'errorMessage',
                            message: 'Detalle no encontrado'
                        });
                    }

                    let area = await RecountArea.findByPk(detail.area);
                    let recountDetail = await RecountDetail.findOne({
                        where: {
                            recount: area.recount,
                            product: detail.product
                        }
                    });

                    recountDetail.final = (recountDetail.final - detail.cant) > 0 ? (recountDetail.final - detail.cant) : 0;
                    if (recountDetail.final == recountDetail.initial) {
                        recountDetail.revised_by = "Sumatoria Sistema";
                    } else {
                        recountDetail.revised_by = null;
                    }
                    await recountDetail.save({ transaction: t });
                    await detail.destroy({ transaction: t });

                    return res.json({
                        status: 'success',
                        data: detail
                    });
                } else if (req.body.case == 'close') {
                    let area = await RecountArea.findByPk(req.body.area);
                    if (area == null) {
                        return res.json({
                            status: 'errorMessage',
                            message: 'El area seleccionada no existe'
                        });
                    }

                    let detail = await RecountAreaDetail.count({
                        where: {
                            area: req.body.area,
                        }
                    });


                    if (detail > 0) {
                        area._status = true;
                        await area.save({ transaction: t });
                    } else {
                        await area.destroy({ transaction: t });
                    }


                    return res.json({
                        status: 'success',
                        data: area
                    });

                } else if (req.body.case == 'reopen') {
                    let area = await RecountArea.findByPk(req.body.area);
                    if (area == null) {
                        return res.json({
                            status: 'errorMessage',
                            message: 'El area seleccionada no existe'
                        });
                    }


                    area._status = false;
                    await area.save({ transaction: t });


                    return res.json({
                        status: 'success',
                        data: area
                    });

                }

                return res.json({
                    status: 'errorMessage',
                    message: 'opcion desconocida'
                });

            });
        } catch (error) {
            console.log(error);

            return res.json({
                status: 'error',
                message: 'Error del Servidor'
            });
        }

    },

    productInArea: async (req, res) => {
        let details = await RecountArea.findAll({
            where: {
                recount: req.params.id,
            }
        });

        let areas = {};
        details.forEach(area => areas[area.id] = area.name);


        details = await RecountAreaDetail.findAll({
            where: {
                product: req.params.product,
                area: {
                    [Op.in]: sequelize.literal(`(SELECT id FROM inventory_recount_area WHERE recount = ${req.params.id})`),
                }
            }
        });


        return res.json(details.map(detail => { return { area: areas[detail.area], cant: detail.cant, by: detail.createdBy } }));



    },


    pdfRecountReport: async (req, res) => {

    },
};


module.exports = StockController;