const Product = require('../Models/Product');
const ProductClassification = require('../Models/ProductClassification');
const Provider = require('../Models/Provider');
const Sucursal = require('../Models/Sucursal');
const Stock = require('../Models/Stock');
const SaleDetail = require('../../CRM/Models/SaleDetail');
const Movement = require('../Models/Movement');

const axios = require('axios').default;
const Helper = require('../../System/Helpers');
const Money = require('../../System/Money');
const sequelize = require("../../DataBase/DataBase");
const { Op, QueryTypes } = require("sequelize");
const path = require('path');
const fs = require('fs');
const StockReserve = require('../Models/StockReserve');
const Sale = require('../../CRM/Models/Sale');
const CatalogDetail = require('../../Web/Models/CatalogDetail');



const ProductController = {
    testTest: async (req, res) => {
        let products = {}
        let tmp = await sequelize.query('select * from inventory_product where id in(select DISTINCT(product) from inventory_product_stock_reserve)', {
            type: QueryTypes.SELECT,
            model: Product,
        });
        tmp.forEach(el => products[el.id] = el);
        let sql = "select sum(cant) as suma, product from inventory_product_stock_reserve  group by product order by product";
        tmp = await sequelize.query(sql, {
            type: QueryTypes.SELECT,
        });

        let response = [];
        let segundo = [];
        tmp.forEach(el => {
            if (products[el.product]) {
                if (el.suma > products[el.product].reserved || el.suma < products[el.product].reserved) {
                    response.push(`${products[el.product].name} id (${products[el.product].id}) tiene diferencias en las reservas (${products[el.product].stock} existencias, ${products[el.product].reserved} en reserva, ${el.suma} suma de reservas, )`)
                } else { segundo.push(`${products[el.product].name} Sin Problemas (${products[el.product].reserved}, ${el.suma}, ${products[el.product].stock})`) }

                if (el.suma > products[el.product].stock) {
                    response.push(`${products[el.product].name} id (${products[el.product].id}) tiene diferencias en las Stock (${products[el.product].reserved}, ${el.suma}, ${products[el.product].stock})`)
                } else { segundo.push(`${products[el.product].name} Sin Problemas (${products[el.product].reserved}, ${el.suma}, ${products[el.product].stock})`) }
            } else {
                response.push(`no se encontro el ${el.product}<br>`);
            }
        });

        return res.json({ response, segundo });




    },


    testTest2: async (req, res) => {
        let products = {}
        let tmp = await sequelize.query('select * from inventory_product where stock > 0', {
            type: QueryTypes.SELECT,
            model: Product,
        });
        tmp.forEach(el => products[el.id] = {
            id: el.id,
            link: `http://localhost:8080/inventory/product/view/${el.id}`,
            link2: `http://143.198.75.85:8080/inventory/product/view/${el.id}`,
            name: el.name,
            stock: el.stock,
            cant: 0
        });


        tmp = await sequelize.query('SELECT * FROM `inventory_product_stock` WHERE product in (select id from inventory_product where stock > 0)', {
            type: QueryTypes.SELECT,
        });
        tmp.forEach(el => products[el.product].cant = products[el.product].cant + el.cant);

        keys = Object.keys(products);
        response = [];
        for (let index = 0; index < keys.length; index++) {
            const product = products[keys[index]];
            if (product.cant !== product.stock) {
                response.push(product);
            }
        }


        products = {}
        tmp = await sequelize.query('select * from inventory_product where id in (SELECT DISTINCT(product) FROM `inventory_product_stock` WHERE cant > 0)', {
            type: QueryTypes.SELECT,
            model: Product,
        });
        tmp.forEach(el => products[el.id] = {
            id: el.id,
            link: `http://localhost:8080/inventory/product/view/${el.id}`,
            link2: `http://143.198.75.85:8080/inventory/product/view/${el.id}`,
            name: el.name,
            stock: el.stock,
            cant: 0
        });


        tmp = await sequelize.query('SELECT * FROM `inventory_product_stock` WHERE cant > 0', {
            type: QueryTypes.SELECT,
        });
        tmp.forEach(el => products[el.product].cant = products[el.product].cant + el.cant);

        keys = Object.keys(products);
        response2 = [];
        for (let index = 0; index < keys.length; index++) {
            const product = products[keys[index]];
            if (product.cant !== product.stock) {
                response.push(product);
            }
        }


        return res.json({
            prueba1: response,
            prueba2: response2
        });
    },


    getVistadeCorreccionDeClassificaciones: async (req, res) => {
        let limit = 15;
        let classification = await ProductClassification.findAll({ attributes: ['id', 'name'], order: [['name', 'asc']], raw: true });
        res.render('Inventory/Product/updateClassification', { pageTitle: 'Corregir Classificaciones', classification: JSON.stringify(classification), limit });

    },

    obtenerProductosACorregir: async (req, res) => {

        let _date = '2024-04-01';
        let search = req.query.search;
        let offset = Number.parseInt(req.query.offset);
        let limit = 15;
        let replacements = { date: _date, offset: offset, limit: limit };
        let sql = "SELECT * FROM `inventory_product` WHERE id not in(SELECT product FROM `inventory_product_movement` WHERE createdAt < :date) order by name ASC Limit :offset,:limit";

        if (search !== undefined) {
            sql = "SELECT * FROM `inventory_product` WHERE name like :search and id not in(SELECT product FROM `inventory_product_movement` WHERE createdAt < :date) order by name ASC Limit :offset,:limit";
            replacements = { date: _date, search: `${search}%`, offset: offset, limit: limit };
        }

        let products = await sequelize.query(sql, {
            type: QueryTypes.SELECT,
            replacements,
            model: Product,
        });

        return res.json(products)
    },

    corregirClassificacion: async (req, res) => {
        let product = await Product.findByPk(req.body.product);


        if (product) {
            product.classification = req.body.classification;
            await product.save();

            return res.json({
                status: 'success',
                data: product.id,
            });
        }


    },

    getCreationView: async (req, res) => {
        let classification = await ProductClassification.findAll({ attributes: ['id', 'name'], order: [['name', 'asc']] });
        res.render('Inventory/Product/create', { pageTitle: 'Crear nuevo Producto', classification });
    },
    createProduct: async (req, res) => {
        let data = req.body;
        let message = null;

        let regex = /"|'|`/g;

        data.name = data.name.replace(regex, '');
        data.code = data.code.replace(regex, '');
        data.SKU = data.SKU.replace(regex, '');
        data.description = data.description.replace(regex, '');
        data.color = data.color.replace(regex, '');


        if (data.name.length < 2) {
            message = 'Por favor, proporcione el nombre de este producto';
        } else if (data.SKU.length < 2) {
            message = 'Debe proporcionar un numero identificador del producto para el Inventario';
        } else if (data.description.length < 10) {
            message = 'Proporcione una descripción';
        }else if (data.description.length > 255) {
            message = 'descripción máxima de 255 caracteres';
        } else if (data.classification.length < 1 || data.classification == "") {
            message = 'Seleccione una Clasificación';
        } else if (data.color.length < 3 || data.color == "") {
            message = 'Proporcione un color';
        }

        let occurency = null;
        if (message === null) {
            occurency = await Product.findAll({ where: { name: `${data.name} ${data.color}` } });
            message = Object.keys(occurency).length > 0 ? 'Ya hay un producto registrado con este nombre exacto, Si se trata de una variacion agrega un diferenciador al nombre, por ejemplo el color' : null;
        }

        //Validar el SKU
        if (message === null) {
            occurency = await Product.findAll({ where: { internal_code: data.SKU } });
            message = Object.keys(occurency).length > 0 ? 'Ya hay un producto registrado con este SKU' : null;
        }

        //Validar la clasificacion
        if (message === null) {
            let clasification = await ProductClassification.findByPk(data.classification);
            if (clasification === null) {
                message = 'La classificación seleccionada no es valida';
            }
        }


        //validar el proveedor
        if (message === null && data.provider != null) {
            let provider = await Provider.findByPk(data.provider);
            if (provider === null) {
                message = 'El proveedor seleccionadono existe';
            }
        }


        if (message !== null) {
            return res.json({
                status: 'errorMessage',
                message: message,
            });
        } else {
            try {
                /**Guardar la imagen si es que ha sido enviada */
                let image_name = null;
                if (data.image.length > 1) {
                    image_name = 'pd_' + Helper.generateNameForUploadedFile() + '.jpg';
                    let location = path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images', image_name);
                    // obtener la data de la imagen sin el inicio 'data:image/jpeg;base64,'
                    let image_data = data.image.slice(23);
                    //Almacenar la imagen
                    fs.writeFile(location, image_data, 'base64', (err) => {
                        if (err) {
                            console.log(err);
                            res.status(500).json({
                                status: 'errorMessage',
                                message: message,
                            });
                        }
                    });
                }



                var product_data = {
                    name: `${data.name} ${data.color}`,
                    provider_code: data.code,
                    internal_code: data.SKU,
                    type: 'product',
                    client_description: null,
                    description: data.description,
                    classification: Number.parseInt(data.classification),
                    provider: data.provider,
                    min_stock: data.min_stock,
                    max_stock: data.max_stock,
                    last_out: null,
                    last_in: null,
                    image: image_name,
                    cost: 0.00,
                    last_cost: 0.00,
                    base_price: data.price,
                    major_price: data.major,
                    createdBy: req.session.userSession.shortName,
                    available_for_sale: true,
                    color: data.color
                };
                var product = await Product.create(product_data);

                var _var_logs = [];
                if (data.variations.length > 0) {
                    let _image_name = null;
                    for (let index = 0; index < data.variations.length; index++) {
                        let _var = data.variations[index];
                        let occurency = await Product.count({ where: { name: `${data.name} ${_var.color}` } });
                        if (occurency > 0) {
                            _var_logs.push(`El producto '${data.name} ${_var.color}' no fue registrado porque ya hay un producto con este nombre`);
                        } else {
                            occurency = await Product.count({ where: { internal_code: _var.code } });
                            if (occurency > 0) {
                                _var_logs.push(`El producto '${data.name} ${_var.color}' no fue registrado porque ya hay un producto con este SKU`);
                            } else {
                                //guardar la imagen
                                _image_name = 'pd_' + Helper.generateNameForUploadedFile() + '.jpg';
                                let location = path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images', _image_name);
                                // obtener la data de la imagen sin el inicio 'data:image/jpeg;base64,'
                                let image_data = _var.image.slice(23);
                                console.log(location)
                                //Almacenar la imagen
                                fs.writeFile(location, image_data, 'base64', (err) => {
                                    if (err) {
                                        console.log(err);
                                        _image_name = null;
                                        _var_logs.push(`la imagen del producto SKU# ${_var.code} no pudo ser procesada`);
                                    }
                                });


                                //actualizar la info de producto

                                product_data.image = _image_name;
                                product_data.color = _var.color;
                                product_data.internal_code = _var.code;
                                product_data.name = data.name + ' ' + _var.color;
                                let _product = await Product.create(product_data);
                                _image_name = null;
                            }
                        }
                    }
                }

                console.log(_var_logs);

                res.json({
                    status: 'success',
                    data: product.id,
                    logs: _var_logs,
                });
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: error.message,
                });
            }
        }
    },
    getProductsView: (req, res) => {
        res.render('Inventory/Product/products', { pageTitle: 'Productos registrados' });
    },
    getProductsToTable: async (req, res) => {
        let params = req.query;
        var query_options = {};

        //Si hay terminos de busqueda, lo agregamos a la SQL
        if (params.search !== undefined && params.search.length > 3) {
            query_options.where = {
                [Op.or]: [
                    { name: { [Op.substring]: params.search } },
                    { provider_code: { [Op.substring]: params.search } },
                    { internal_code: { [Op.substring]: params.search } },
                    { description: { [Op.substring]: params.search } },
                ]
            }
        }

        //Si Hay parametros de Ordenamiento
        if (params.order !== undefined) {
            query_options.order = [[params.order, params.dir],];
        } else {
            query_options.order = [['name', 'ASC'],];
        }
        try {
            let result = {
                params: params,
            };
            result.total_rows = query_options;
            result.total_rows.col = 'id';
            result.total_rows = await Product.count(result.total_rows);

            query_options.offset = parseInt(params.offset);
            query_options.limit = parseInt(params.limit);
            result.data = await Product.findAll(query_options);

            //Formatear y regresar el arreglo
            return res.json(result);
        } catch (error) {
            return res.status(500).json({ 'error': 'Internal Server Error' });
        }

    },

    getProduct: async (req, res) => {
        let product = await Product.findOne({ where: { id: req.params.id }, raw: true });
        // let product = await Product.findByPk(req.params.id);
        if (product === null) {
            //return res.status(404);
            return Helper.notFound(req, res, 'Product no Found')
        }

        let almacen = {};
        //obtener los almacenes
        let tmp = await Sucursal.findAll({ attributes: ['id', 'name'] });
        //indexar los almacenes
        if (tmp.length > 0) {
            tmp.forEach(element => {
                almacen[element.id] = { sucursal_id: element.id, name: element.name, cant: 0, reserved: 0 };
            })
        } else {
            almacen = null;
        }
        //obtener la classificacion
        let classification = await ProductClassification.findByPk(product.classification);

        //Obtener el numero total de existencias
        tmp = await Stock.findAll({
            where: {
                product: product.id
            },
        });

        let stock = 0;
        //Indexar las existencias por almacen
        if (tmp.length > 0) {
            tmp.forEach(element => {
                almacen[element.sucursal]['cant'] = element.cant;
                almacen[element.sucursal]['reserved'] = element.reserved;
                stock += (element.cant - element.reserved);
            })
        }

        product.classification = classification;
        product.available = stock;
        product.stocks = almacen;
        res.json(product);


    },

    viewProduct: async (req, res) => {
        let product = await Product.findByPk(req.params.id);
        if (product === null) {
            // return res.status(404).json({response: 'Not Found'});
            return Helper.notFound(req, res, 'Product no Found')
        }
        let almacen = [];
        //obtener los almacenes
        let tmp = await Sucursal.findAll({ attributes: ['id', 'name'] });
        //indexar los almacenes
        if (tmp.length > 0) {
            tmp.forEach(element => {
                almacen[element.id] = { 'name': element.name, cant: 0, reserved: 0 };
            })
        } else {
            almacen = null;
        }
        //obtener la classificacion
        let classification = await ProductClassification.findByPk(product.classification);
        //Obtener el numero total de existencias
        tmp = await Stock.findAll({
            where: {
                product: product.id
            },
        });

        let stock = 0;
        //Indexar las existencias por almacen
        if (tmp.length > 0) {
            tmp.forEach(element => {
                almacen[element.sucursal]['cant'] = element.cant;
                almacen[element.sucursal]['reserved'] = element.reserved;
                stock += (element.cant - element.reserved);
            })
        }


        //buscar lso detalles de las ventas
        let _sql = `select crm_sale.id as sale_id, crm_client.id as client_id, crm_client.name as client_name, crm_sale_detail.* from crm_sale_detail INNER JOIN crm_sale on crm_sale.id = crm_sale_detail.sale INNER JOIN crm_client on crm_client.id = crm_sale.client where crm_sale_detail.id in(SELECT saleId FROM inventory_product_stock_reserve WHERE product = :product) Order By crm_sale_detail.id ASC`;
        let in_reserve = await sequelize.query(_sql, {
            replacements: { product: product.id },
            type: QueryTypes.SELECT
        });

        let largo = in_reserve.length;

        for (let index = 0; index < largo; index++) {
            in_reserve[index].reserve = await StockReserve.findOne({
                where: {
                    saleId: in_reserve[index].id
                }
            })

        }

        let transfers = await sequelize.query('SELECT inventory_product_stock_reserve.*,  inventory_requisition_detail.requisition, inventory_requisition_detail.createdBy FROM `inventory_product_stock_reserve` inner join inventory_requisition_detail on inventory_requisition_detail.id = inventory_product_stock_reserve.orderId WHERE inventory_product_stock_reserve.product = :product and inventory_product_stock_reserve.orderId is not null;', {
            replacements: { product: product.id },
            type: QueryTypes.SELECT
        });

        //buscar los catalogos donde este agregado
        let catalogs = await sequelize.query('select * from web_catalog where id in(SELECT catalog FROM `web_catalog_details` WHERE product = :product);', {
            replacements: { product: product.id },
            type: QueryTypes.SELECT
        });

        //

        res.render('Inventory/Product/view', {
            product,
            pageTitle: product.name,
            stock, almacen, classification,
            in_reserve, transfers, catalogs
        });

    },

    editProduct: async (req, res) => {
        let product = await Product.findByPk(req.params.id);
        if (product === null) {
            return res.status(404);
        }
        //obtener la classificacion
        let classification = await ProductClassification.findByPk(product.classification);
        let provider = await Provider.findByPk(product.provider);
        res.render('Inventory/Product/edit', {
            product,
            pageTitle: `Editando ${product.name}`,
            provider,
            classification
        });

    },

    updateProduct: async (req, res) => {
        let data = req.body;
        let message = null;

        let product = await Product.findByPk(req.params.id);
        if (product === null) {
            return res.status(404);
        }

        if (data.name.length < 2) {
            message = 'Por favor, proporcione el nombre de este producto';
        } else if (data.description.length < 10) {
            message = 'Proporcione una descripción';
        }else if (data.description.length > 255) {
            message = 'Descripcion máxima de 255 caracteres';
        } else if (data.classification.length < 1 || data.classification == "") {
            message = 'Seleccione una Clasificación';
        } /*else if (data.provider.length < 1 || data.provider == "") {
            message = 'Seleccione un Proveedor';
        }*/

        let occurency = null;
        if (message === null) {
            occurency = await Product.findAll({
                where: {
                    [Op.and]: [
                        { name: data.name },
                        { id: { [Op.not]: product.id } },
                    ],
                },
            });
            message = Object.keys(occurency).length > 0 ? 'Ya hay un producto registrado con este nombre exacto, Si se trata de una variacion agrega un diferenciador al nombre, por ejemplo el color' : null;
        }



        //Validar la clasificacion
        if (message === null) {
            let clasification = await ProductClassification.findByPk(data.classification);
            if (clasification === null) {
                message = 'La classificación seleccionada no es valida';
            }
        }


        //validar el proveedor
        if (message === null) {
            let provider = await Provider.findByPk(data.provider);
            if (provider === null) {
                data.provider = null;
            }
        }

        if (message !== null) {
            res.json({
                status: 'errorMessage',
                message: message,
            });
        } else {
            try {
                /**Guardar la imagen si es que ha sido enviada */
                let image_name = product.image.slice(15);

                if (data.image.length > 1) {
                    image_name = 'pd_' + Helper.generateNameForUploadedFile() + '.jpg';
                    let location = path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images', image_name);
                    // obtener la data de la imagen sin el inicio 'data:image/jpeg;base64,'
                    let image_data = data.image.slice(23);
                    //Almacenar la imagen
                    fs.writeFile(location, image_data, 'base64', async (err) => {
                        if (err) {
                            console.log(err);
                            res.status(500).json({
                                status: 'errorMessage',
                                message: message,
                            });
                        } else {
                            console.log('La imagen se guardó correctamente en el servidor.');
                            //enviar la solicitu a la imagen con el link de actualizacion

                            let png = await axios.get(`https://riverasgroup.com/image?renew=true&img=${image_name}`, { responseType: 'arraybuffer' });
                        }
                    });


                    //Verificar si hay detalles que tengan la imagen, si no sobreescribir la imagen
                    //pendiente
                }

                product.name = data.name;
                product.provider_code = data.code;
                product.type = 'product';
                product.description = data.description;
                product.classification = data.classification;
                product.provider = data.provider;
                product.min_stock = data.min_stock;
                product.max_stock = data.max_stock;
                product.image = image_name;
                product.base_price = data.price;
                product.major_price = data.major;

                product.save();

                res.json({
                    status: 'success',
                    data: product.id,
                });
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: error.message,
                });
            }
        }
    },

    updateProductforWeb: async (req, res) => {
        try {
            let product = await Product.findByPk(req.params.id);
            if (product === null) {
                return res.status(404);
            }

            product.in_web = !product.in_web;
            await product.save();

            return res.json({
                status: 'success',
            });
        } catch (error) {
            return res.status(500).json({
                status: 'error',
                message: error.message,
            });
        }
    },

    
    updateDamaged: async (req, res) => {
        try {
            let product = await Product.findByPk(req.body.product);
            if (product === null) {
                return res.status(404);
            }

            product.damaged = req.body.cant;
            await product.save();

            return res.json({
                status: 'success',
            });
        } catch (error) {
            return res.status(500).json({
                status: 'error',
                message: error.message,
            });
        }
    },

    getProductsToSelect2: async (req, res) => {
        let searchLimit = 15;
        let search = req.query.search;
        try {
            if (req.query.onlystock == 'true') {
                if (req.query.sucursal !== undefined) {
                    let sucursal = Number.parseInt(req.query.sucursal);
                    console.log(sucursal)
                    let products = await sequelize.query(
                        "SELECT * FROM `inventory_product` WHERE (name like :search or internal_code like :search) and id in(SELECT product FROM `inventory_product_stock` WHERE sucursal = :sucursal and cant > reserved) order by name ASC Limit 0,:limit",
                        {
                            replacements: { search: `%${search}%`, limit: searchLimit, sucursal },
                            type: QueryTypes.SELECT
                        }
                    );

                    //buscar los stock e indexarlos

                    let stock = await sequelize.query(
                        "SELECT * FROM `inventory_product_stock` WHERE sucursal = :sucursal and cant > reserved and product in(SELECT id FROM `inventory_product` WHERE name like :search or internal_code like :search); ",
                        {
                            replacements: { search: `%${search}%`, sucursal },
                            type: QueryTypes.SELECT
                        }
                    );

                    //indexar los stock
                    let indexed_stocks = {};
                    stock.forEach(st => {
                        let stock = Number.parseInt(st.cant),
                            reserved = Number.parseInt(st.reserved);

                        indexed_stocks[st.product] = { stock, reserved };
                    });

                    return res.json(products.map(el => {

                        let label = `${el.name}  #SKU(${el.internal_code})`;

                        let html_label = `<div class="row"><img src="${el.image !== null ? (el.image.includes('http') ? el.image : `/upload/images/${el.image}`) : '/upload/images/image-not-found.png'}" alt="product" style="max-width: 100px;" class="col-4"><span class="col-8">${label}</span></div>`;

                        return {
                            id: el.id,
                            value: el.id,
                            label: html_label,
                            sku: el.internal_code,
                            image: el.image !== null ? (el.image.includes('http') ? el.image : `/upload/images/${el.image}`) : '/upload/images/image-not-found.png',
                            price: el.base_price,
                            major: el.major_price,
                            stock: indexed_stocks[el.id].stock !== undefined ? indexed_stocks[el.id].stock : 0,
                            reserved: indexed_stocks[el.id].reserved !== undefined ? indexed_stocks[el.id].reserved : 0,
                            name: el.name,
                        }
                    }));

                }

                let products = await sequelize.query(
                    "SELECT * FROM `inventory_product` WHERE (name like :search or internal_code like :search) and stock > reserved order by name ASC Limit 0,:limit ",
                    {
                        replacements: { search: `%${search}%`, limit: searchLimit, },
                        type: QueryTypes.SELECT
                    }
                );

                return res.json(products.map(el => {

                    let label = `${el.name}  #SKU( ${el.internal_code} )`;

                    let html_label = `<div class="row"><img src="${el.image !== null ? (el.image.includes('http') ? el.image : `/upload/images/${el.image}`) : '/upload/images/image-not-found.png'}" alt="product" style="max-width: 100px;" class="col-4"><span class="col-8">${label}</span></div>`;

                    return {
                        id: el.id,
                        value: el.id,
                        label: html_label,
                        sku: el.internal_code,
                        image: el.image !== null ? (el.image.includes('http') ? el.image : `/upload/images/${el.image}`) : '/upload/images/image-not-found.png',
                        price: el.base_price,
                        major: el.major_price,
                        stock: el.stock,
                        reserved: el.reserved,
                        name: el.name,
                    }

                }));
            }

            let products = await Product.findAll({
                where: {
                    [Op.or]: [
                        { name: { [Op.substring]: search } },
                        { provider_code: { [Op.substring]: search } },
                        { internal_code: { [Op.substring]: search } },
                    ],
                },
                order: [
                    ['name', 'ASC'],
                ],
                limit: searchLimit,
                raw: true,
            });


            return res.json(products.map(el => {

                let label = `${el.name}  #SKU(${el.internal_code})`;

                let html_label = `<div class="row"><img src="${el.image !== null ? (el.image.includes('http') ? el.image : `/upload/images/${el.image}`) : '/upload/images/image-not-found.png'}" alt="product" style="max-width: 100px;" class="col-4"><span class="col-8">${label}</span></div>`;
                return {
                    id: el.id,
                    value: el.id,
                    label: html_label,
                    sku: el.internal_code,
                    image: el.image !== null ? (el.image.includes('http') ? el.image : `/upload/images/${el.image}`) : '/upload/images/image-not-found.png',
                    price: el.base_price,
                    major: el.major_price,
                    stock: el.stock,
                    reserved: el.reserved,
                    name: el.name,
                }
            }));
            /** Select id, id as value, name as label from providers where name like '%search%' order by name asc limit x */
            // return res.json(products);
        } catch (error) {
            console.log(error.message)
            return res.status(500).json({ 'error': 'Internal Server Error' });
        }
    },
    archive: async (req, res) => {
        let product = await Product.findByPk(req.params.id);
        if (product) {
            let count = await SaleDetail.count({
                where: {
                    product: product.id
                }
            });

            if (count > 0) {
                return res.json({
                    status: 'error',
                    message: 'No se puede Eliminar este producto, hay registros de ventas relacionados a este',
                });
            }

            count = await Movement.count({
                where: {
                    product: product.id
                }
            });

            if (count > 0 || product.stock > 0) {
                return res.json({
                    status: 'error',
                    message: 'No se puede Eliminar este producto, hay registros de movimientos relacionados a este',
                });
            }
            try {
                let __name = path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images', product.raw_image_name);

                fs.exists(__name, (exists) => {
                    if (exists) {
                        fs.unlinkSync(__name);

                    }
                });
            } catch (err) {
                console.log(err)
            }
            let result = await product.destroy();
            return res.json({
                status: 'success',
                message: 'Registro Eliminado',

            });
        }
        return Helper.notFound(req, res, aditional = 'Product Not Found!');
    }




};

module.exports = ProductController;