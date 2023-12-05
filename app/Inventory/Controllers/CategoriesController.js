const ProductClassification = require('../Models/ProductClassification');
const Helper = require('../../System/Helpers');
const { Op } = require("sequelize");
const path = require('path');
const fs = require('fs');
const Product = require('../Models/Product');





const CategoriesController = {

    createClassification: async (req, res) => {
        let data = req.body;
        let message = null;

        if (data.name.length < 2) {
            message = 'Por favor, proporcione el nombre para la nueva Sucursal';
        }

        if (message === null) {
            //validar que el nombre no este registrado
            let occurency = await ProductClassification.findAll({ where: { name: data.name } });
            message = Object.keys(occurency).length > 0 ? 'Ya hay una categoria de productos registrada con este nombre' : message;
        }



        if (message !== null) {
            res.json({
                status: 'errorMessage',
                message: message,
            });
        } else {
            try {

                let image_name = null;
                if (data.image.length > 1) {
                    image_name = 'cat_' + Helper.generateNameForUploadedFile() + '.jpg';
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

                const category = await ProductClassification.create({
                    name: data.name,
                    image: image_name,
                });
                res.json({
                    status: 'success',
                    data: category.id,
                });
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: error.message,
                });
            }
        }
    },
    getClassificationsView: async (req, res) => {
        //buscar todas las sucursales
        let clasifications = await ProductClassification.findAll({
            attributes: ['name', 'image', 'id']
        });

        console.log(clasifications);
        res.render('Inventory/ProductClassification/clasifications', { pageTitle: 'Categorias de Productos', clasifications });
    },

    getClassification: async (req, res) => {
        let classification = await ProductClassification.findByPk(req.params.id);
        if (classification === null) {
            return res.status(404);
        }
        res.json({
            classification
        });


    },
    viewClassification: async (req, res) => {//pendiente
        let classification = await ProductClassification.findByPk(req.params.id);
        if (classification === null) {return res.status(404);}

        console.log(req.query.onlyStock);
        //buscar los productos, verificar si se ha pasado el parametro de solo con existencias.
        let onlyStocks = req.query.onlyStock === undefined || req.query.onlyStock == 'true' ? true : false;

        let options = onlyStocks == true ?  {
            where:{
                'classification': classification.id,
                'stock': {[Op.gt]: 0}
            }, order: [
                ['name', 'ASC'],
            ],
        } : {
            where:{
                'classification': classification.id,
            }, order: [
                ['name', 'ASC'],
            ],
        };

        console.log(onlyStocks, options)

        let products = await Product.findAll(options);

        res.render('Inventory/ProductClassification/clasification', {
            classification,
            pageTitle: classification.name,
            products,
            onlyStocks,
        });

    },
    updateClassification: async (req, res) => { }, //pendiente
    getCategoriesToSelect2: async(req, res) => {
        
        let searchLimit = 15;
        let search = req.query.search;
        try {
            let categories = await ProductClassification.findAll({
                where: {
                    name: {
                        [Op.substring]: search
                    }
                },
                order: [
                    ['name', 'ASC'],
                ],
                limit: searchLimit,
                attributes: [
                    'id',
                    ['id', 'value'],
                    ['name', 'label']
                ]
            });
            /** Select id, id as value, name as label from product_classificactions where name like '%search%' order by name asc limit x */
            return res.json(categories);
        } catch (error) {
            return res.status(500).json({ 'error': 'Internal Server Error' });
        }


    
    }
};

module.exports = CategoriesController;