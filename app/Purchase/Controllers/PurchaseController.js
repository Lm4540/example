const Helper = require('../../System/Helpers');
const Money = require('../../System/Money');
const sequelize = require("../../DataBase/DataBase");
const { Op, QueryTypes } = require("sequelize");

const Provider = require("../../Inventory/Models/Provider");
const Sucursal = require("../../Inventory/Models/Sucursal");
const Purchase = require("../Models/Purchase");
const PurchaseCost = require("../Models/PurchaseCost");
const PurchaseDetail = require("../Models/PurchaseDetail");
const Product = require('../../Inventory/Models/Product');
const Stock = require('../../Inventory/Models/Stock');
const Movement = require('../../Inventory/Models/Movements');
const invoice_types = { invoice: 'Factura (Importacion)', fc: 'Factura Comercial', ccf: 'Comprabante de Credito Fiscal', fcf: 'Factura de Consumidor Final' };
const purchase_types = { equipment_purchase: 'Compra de Equipo', sale_expense: 'Gastos sobre Ventas', purchase_expense: 'Gastos sobre Compras', services: 'Serivios (Internet, Corriente Electrica, Agua, etc)' };


const PurchaseController = {

    creation_view: async (req, res) => {

        // try {
        //     sequelize.sync({ force: false });
        // } catch (error) {

        // }


        let providers = await Provider.findAll({
            order: [
                ['name', 'ASC'],
            ],
            raw: true, attributes: [
                'id',
                'name', 'type', 'NIT_DUI', 'NRC', 'isLocal', 'isRetentionAgent', 'classification', 'phone'

            ]
        });
        let indexed_providers = {};
        provs = {
            product: [],
            services: [],
            transport: []
        };

        providers.forEach(element => {
            indexed_providers[element.id] = element;
            provs[element.type].push(element);
        });


        res.render('Purchase/new', {
            pageTitle: 'Registrar Compra',
            providers: provs,
            indexed_providers,
            excluded_series: []
        })
    },

    register_purchase: async (req, res) => {
        let data = req.body;
        console.log(data);
        let provider = await Provider.findByPk(data.provider);

        if (provider == null) {
            return res.json({ status: 'errorMessage', message: 'Proveedor no seleccionado' });
        }

        let errorMessage = null;
        if ((data.invoice_type == 'fc' || data.invoice_type == 'ccf') && data.nit.length < 9) {
            errorMessage = 'El numero de NIT o DUI del proveedor es un dato Obligatorio';
        } else if (data.invoice_type == 'ccf' && data.nrc == "") {
            errorMessage = 'El numero de Registro del proveedor es un dato Obligatorio';
        } else if (data.invoice_date == '' || data.invoice_date.length < 10) {
            errorMessage = 'ingrese la fecha de la factura';
        } else if (data.invoice_number == '' || data.invoice_number.length < 1) {
            errorMessage = 'Ingrese el numero de la factura';
        } else if (data.details.length < 1) {
            errorMessage = 'Agregue detalles al cuerpo de la compra';
        }


        if (errorMessage) {
            return res.json({ status: 'errorMessage', message: errorMessage });
        } else {

            //buscar si ya hay una venta con ese mismo numero de documento
            let existe = await Purchase.count({
                where: {
                    provider: data.provider,
                    invoice_type: data.invoice_type,
                    invoice_number: data.invoice_number
                }
            });

            if (existe > 0) {
                return res.json({ status: 'errorMessage', message: 'El proveedor seleccionado ya tiene una compra registrada con este numero de documento' });
            }

            try {
                return await sequelize.transaction(async (t) => {
                    //registrar la compra
                    let purchase = await Purchase.create({
                        provider: data.provider,
                        subtotal: 0.00,
                        iva: 0.00,
                        renta: 0.00,
                        other_taxes: data.other_taxes,
                        invoice_type: data.invoice_type,
                        invoice_number: data.invoice_number,
                        invoice_date: data.invoice_date,
                        credit_conditions: data.credit_days,
                        _nit: data.nit,
                        _ncr: data.nrc,
                        isIn: false,
                        purchase_type: data.purchase_type == 'local' || data.purchase_type == 'internacional' ? 'product' : data.purchase_type,
                        createdBy: req.session.userSession.name,
                    }, { transaction: t });

                    let subtotal = 0.00, len = data.details.length;
                    let to_inventory = false;
                    // / recorrer y registrar los detalles
                    for (let index = 0; index < len; index++) {
                        let dt = data.details[index];
                        subtotal += (Number.parseFloat(dt.price) * Number.parseInt(dt.cant));
                        let l = await PurchaseDetail.create({
                            purchase: purchase.id,
                            cant: dt.cant,
                            price: dt.price,
                            description: dt.description,
                            code: dt.code,
                            color: dt.color,
                            in: 0,
                            uniMedida: 59,
                            detail_type: dt.type,
                        }, { transaction: t });
                        console.log(to_inventory == false && dt.type == 'product')
                        if(to_inventory == false && dt.type == 'product'){
                            to_inventory = true;
                        }
                    }

                    purchase.subtotal = subtotal;

                    if (data.invoice_type == 'fc') { purchase.renta = subtotal * 0.1; }
                    if (data.invoice_type == 'ccf') {
                        purchase.iva = subtotal * 0.13;
                        if (data.isRetentionAgent == true || data.isRetentionAgent == 'true') {
                            purchase.iva_percibido = subtotal * 0.01;
                        }
                    }
                    console.log(purchase.purchase_type == 'product' && to_inventory == false)
                    if(purchase.purchase_type == 'product' && to_inventory == false){
                        purchase.purchase_type = "services";
                    }
                    await purchase.save({ transaction: t });

                    return res.json({ status: 'success', message: 'Guardado Correctamente', data: purchase.id });

                });
            } catch (error) {
                console.log(error);
                return res.json({ status: 'errorMessage', message: error.message });
            }




        }

        //validar lso datos
    },

    get_registered_view: async (req, res) => {
        res.render('Purchase/registered', {
            pageTitle: 'Compras Registradas',
        });
    },

    get_registered: async (req, res) => {

        let init = req.query.init;
        let end = req.query.end;
        let details = [],
            providers = {};
        let tmp = await sequelize.query(
            "SELECT id, name FROM `inventory_provider` WHERE id in (SELECT provider FROM `purchase` WHERE invoice_date BETWEEN :init and :end or createdAt BETWEEN :init and :end)",
            {
                replacements: { init: init, end: end },
                type: QueryTypes.SELECT
            }
        );
        tmp.forEach(e => { providers[e.id] = e.name; });
        tmp = await sequelize.query(
            "SELECT * FROM `purchase` WHERE invoice_date BETWEEN :init and :end or createdAt BETWEEN :init and :end",
            {
                replacements: { init: init, end: end },
                type: QueryTypes.SELECT,
                model: Purchase
            }
        );
        tmp.forEach(element => {
            let subtotal = Number.parseFloat(element.subtotal) + Number.parseFloat(element.iva) + Number.parseFloat(element.iva_percibido) + Number.parseFloat(element.other_taxes) - Number.parseFloat(element.renta) - Number.parseFloat(element.iva_retenido);
            details.push({
                provider: providers[element.provider],
                date: Helper.format_date(element.invoice_date + 'T00:00:00', false),
                createdAt: Helper.format_date(element.createdAt, true),
                document: `${invoice_types[element.invoice_type]} N° ${element.invoice_number}`,
                id: element.id,
                amount: `$${Money.money_format(subtotal)}`,
            })

        });

        return res.json(details,);

    },

    view_purchase: async (req, res) => {

        //buscar la compra
        let purchase = await Purchase.findByPk(req.params.id);
        if (purchase) {
            let details = await PurchaseDetail.findAll({
                where: {
                    purchase: purchase.id
                }
            });
            let provider = await Provider.findByPk(purchase.provider);
            return res.render('Purchase/view', {
                pageTitle: 'Ver Compra',
                purchase,
                details,
                provider,
                invoice_types,
                permission: req.session.userSession.permission,
                purchase_types
            });
        }
        return Helper.notFound(req, res, 'Purchase not Found');
    },

    get_to_in: async (req, res) => {
        //buscar la compras
        let purchases = await Provider.findAll({
            where: {
                id: {
                    [Op.in]: sequelize.literal("(select provider from purchase where purchase_type = 'product' and isIn = 0)")
                }
            }
        });

        let providers = {};
        purchases.forEach(el => providers[el.id] = el.name);

        purchases = await Purchase.findAll({
            where: {
                [Op.and]: {
                    purchase_type: 'product',
                    isIn: 0
                }
            }
        });

        return res.render('Purchase/ListToIn', {
            pageTitle: 'Compras pendientes de ingreso',
            purchases,
            providers,
            invoice_types
        });


    },

    in_purchase: async (req, res) => {

        //buscar la compra
        let purchase = await Purchase.findByPk(req.params.id);
        if (purchase) {
            if(purchase.purchase_type != 'product' ){
                return res.redirect('/purchase/view/'+purchase.id);
            }else if(purchase.isIn){
                return res.redirect('/purchase/cost/'+purchase.id);
            }
            
            let details = await PurchaseDetail.findAll({
                where: {
                    purchase: purchase.id
                }, raw: true,
            });
            let provider = await Provider.findByPk(purchase.provider);
            let sucursals = await Sucursal.findAll();
            let indexed_details = {};

            details.forEach(det => indexed_details[det.id] = det);

            if (purchase.purchase_type == "product" && purchase.isIn == 0) {
                return res.render('Purchase/in', {
                    pageTitle: 'Ver Compra',
                    purchase,
                    details,
                    provider,
                    invoice_types,
                    sucursals,
                    indexed_details,
                    UserSucursal: req.session.userSession.employee.sucursal
                });
            }

            // mostrar la vista de la compra ya ingresada
            return Helper.notFound(req, res, 'This purchase cannot be processed in this section');
        }
        return Helper.notFound(req, res, 'Purchase not Found');
    },

    in_purchase_to_inventory: async (req, res) => {
        //buscar la compra
        let data = req.body;
        let purchase = await Purchase.findByPk(data.purchase);

        if (purchase) {
            if (purchase.purchase_type == "product" && purchase.isIn == 0) {


                let details = await PurchaseDetail.findAll({
                    where: { purchase: purchase.id }
                });

                let provider = await Provider.findByPk(purchase.provider);

                try {
                    return res.json(await sequelize.transaction(async (t) => {
                        //registrar los costos
                        let len = data.costs.length;
                        let total_cost = 0.00;
                        let generla_concept = `Ingreso de ${purchase.invoice_type} N° ${purchase.invoice_number} del proveedor ${provider.name}`;
                        if (len > 0) {
                            for (let index = 0; index < len; index++) {
                                let cost = data.costs[index];
                                total_cost += Number.parseFloat(cost.cost);

                                //registrar el costo
                                cost = await PurchaseCost.create({
                                    purchase: purchase.id,
                                    description: cost.description,
                                    price: cost.cost
                                }, { transaction: t });
                            }
                        }


                        len = details.length;
                        if (total_cost > 0) {
                            for (let index = 0; index < len; index++) {
                                let detail = details[index];
                                detail.in = detail.cant - data.details[detail.id].faltante;
                                detail.identified = detail.in;
                                detail.identification = data.details[detail.id].products;

                                //determinar el costo del Item
                                let percent = (detail.cant * detail.price) / purchase.subtotal;
                                let dt_cost = (percent * total_cost);

                                let cost = (Number.parseFloat(detail.price) + Number.parseFloat((dt_cost / detail.in).toFixed(2)));

                                detail.cost = cost;
                                detail.save({ transaction: t });

                                //recorrer los productos para darle ingreso al inventario
                                let contador = data.details[detail.id].products.length;
                                for (let indice = 0; indice < contador; indice++) {
                                    let cantidad_selecciona = data.details[detail.id].products[indice].cant;
                                    //Buscar el Producto
                                    let product = await Product.findByPk(data.details[detail.id].products[indice].product);

                                    //buscar el Stock
                                    //Compriobar si hay stocks creados en esa sucursal
                                    let stock = await Stock.findOne({
                                        where: {
                                            [Op.and]: [
                                                { 'product': product.id },
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
                                            'sucursal': data.sucursal,
                                            'cant': cantidad_selecciona,
                                            'reserved': 0,
                                        }, { 'transaction': t });

                                    } else {
                                        last_sucursal_stock = stock.cant;
                                        stock.cant += cantidad_selecciona;
                                        await stock.save({ 'transaction': t });
                                    }

                                    //calcular el costo promedio y actualizar el registro del producto
                                    let last_cost = product.cost;
                                    let last_stock = product.stock;

                                    console.log('\n\n', 'ultimo costo de Producto', last_cost)
                                    console.log('\n\n', 'ultimo stock de Producto', last_stock)
                                    console.log('\n\n', 'Suma del valor anterior', (last_cost * last_stock))
                                    console.log('\n\n', 'Suma del valor nuevo', (cantidad_selecciona * cost))
                                    console.log('\n\n', 'Suma del total stock', (cantidad_selecciona + last_stock))


                                    product.cost = ((last_cost * last_stock) + (cantidad_selecciona * cost)) / (cantidad_selecciona + last_stock);
                                    product.stock += cantidad_selecciona;
                                    product.last_cost = last_cost;

                                    await product.save({ transaction: t });

                                    //registrar el movimiento
                                    let move = await Movement.create({
                                        last_sucursal_stock: last_sucursal_stock,
                                        last_product_stock: last_stock,
                                        cant: cantidad_selecciona,
                                        cost: cost,
                                        last_cost: last_cost,
                                        in: true,
                                        product: product.id,
                                        concept: generla_concept,
                                        sucursal: data.sucursal,
                                    }, { transaction: t });
                                }
                            }
                        } else {
                            for (let index = 0; index < len; index++) {
                                let detail = details[index];
                                detail.in = detail.cant - data.details[detail.id].faltante;
                                detail.identified = detail.in;
                                detail.identification = data.details[detail.id].products;

                                //determinar el costo del Item
                                let cost = Number.parseFloat((detail.cant * detail.price) / (detail.in));

                                detail.cost = cost;
                                detail.save({ transaction: t });
                                //recorrer los productos para darle ingreso al inventario
                                let contador = data.details[detail.id].products.length;
                                for (let indice = 0; indice < contador; indice++) {
                                    let cantidad_selecciona = data.details[detail.id].products[indice].cant;
                                    //Buscar el Producto
                                    let product = await Product.findByPk(data.details[detail.id].products[indice].product);

                                    //buscar el Stock
                                    //Compriobar si hay stocks creados en esa sucursal
                                    let stock = await Stock.findOne({
                                        where: {
                                            [Op.and]: [
                                                { 'product': product.id },
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
                                            'sucursal': data.sucursal,
                                            'cant': cantidad_selecciona,
                                            'reserved': 0,
                                        }, { 'transaction': t });

                                    } else {
                                        last_sucursal_stock = stock.cant;
                                        stock.cant += cantidad_selecciona;
                                        await stock.save({ 'transaction': t });
                                    }

                                    //calcular el costo promedio y actualizar el registro del producto
                                    let last_cost = product.cost;
                                    let last_stock = product.stock;

                                    product.cost = ((last_cost * last_stock) + (cantidad_selecciona * cost)) / (cantidad_selecciona + last_stock);
                                    product.stock += cantidad_selecciona;
                                    product.last_cost = last_cost;

                                    await product.save({ transaction: t });

                                    //registrar el movimiento
                                    let move = await Movement.create({
                                        last_sucursal_stock: last_sucursal_stock,
                                        last_product_stock: last_stock,
                                        cant: cantidad_selecciona,
                                        cost: cost,
                                        last_cost: last_cost,
                                        in: true,
                                        product: product.id,
                                        concept: generla_concept,
                                        sucursal: data.sucursal,
                                    }, { transaction: t });
                                }
                            }
                        }

                        //Actualizar el registro de la compra

                        purchase.isIn = true;
                        purchase.inComments = data.observation;
                        await purchase.save({ transaction: t });

                        return { status: 'success', message: 'Compra Ingresada al Inventario correctamente', purchase }


                    }));
                } catch (error) {
                    console.log(error);
                    return res.json({ status: 'errorMessage', message: error.message });
                }
            }
        }
        return res.json({ status: 'errorMessage', message: 'La compra no ha sido encontrada o ya fue ingresada al Inventario' });

    },

    cost_purchase: async (req, res) => {
        //buscar la compra
        let purchase = await Purchase.findByPk(req.params.id);
        if (purchase) {
            let details = await PurchaseDetail.findAll({
                where: {
                    purchase: purchase.id
                }
            });
            let provider = await Provider.findByPk(purchase.provider);

            if (purchase.isIn == true) {
                let costs = await PurchaseCost.findAll({
                    where: {
                        purchase: purchase.id
                    }
                });

                return res.render('Purchase/viewCost', {
                    pageTitle: 'Ver Compra',
                    purchase,
                    details,
                    provider,
                    invoice_types,
                    permission: req.session.userSession.permission,
                    costs
                });
            }
            return res.redirect(`/purchase/view/${purchase.id}`);
        }
        return Helper.notFound(req, res, 'Purchase not Found');
    }
};

module.exports = PurchaseController;