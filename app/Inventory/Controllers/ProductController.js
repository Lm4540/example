const Product = require('../Models/Product');
const ProductClassification = require('../Models/ProductClassification');
const Provider = require('../Models/Provider');
const Sucursal = require('../Models/Sucursal');
const Stock = require('../Models/Stock');
const SaleDetail = require('../../CRM/Models/SaleDetail');

const Movement = require('../Models/Movements');

const Helper = require('../../System/Helpers');
const Money = require('../../System/Money');
const sequelize = require("../../DataBase/DataBase");
const { Op, QueryTypes } = require("sequelize");
const path = require('path');
const fs = require('fs');



const ProductController = {
    getCreationView: async (req, res) => {
        let classification = await ProductClassification.findAll({ attributes: ['id', 'name'] });
        res.render('Inventory/Product/create', { pageTitle: 'Crear nuevo Producto', classification });
    },
    createProduct: async (req, res) => {
        let data = req.body;
        let message = null;

        if (data.name.length < 2) {
            message = 'Por favor, proporcione el nombre de este producto';
        } else if (data.SKU.length < 2) {
            message = 'Debe proporcionar un numero identificador del producto para el Inventario';
        } else if (data.description.length < 10) {
            message = 'Proporcione una descripción';
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
            res.json({
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
                    createdBy: 'user logged',
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

                                console.log(product_data);
                                console.log('guardando la data', ' \n');
                                product_data.image = _image_name;
                                product_data.color = _var.color;
                                product_data.internal_code = _var.code;
                                product_data.name = data.name + ' ' + _var.color;
                                let _product = await Product.create(product_data);
                                console.log('producto creado con id: ' + _product.id, ' \n');
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

        res.render('Inventory/Product/view', {
            product,
            pageTitle: product.name,
            stock, almacen, classification
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
                    fs.writeFile(location, image_data, 'base64', (err) => {
                        if (err) {
                            console.log(err);
                            res.status(500).json({
                                status: 'errorMessage',
                                message: message,
                            });
                        } else {
                            console.log('La imagen se guardó correctamente en el servidor.');
                        }
                    });
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

                        indexed_stocks[st.product] = {stock,reserved};
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
            //si llega a ca proceder con la eliminacion del registro
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