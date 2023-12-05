const Provider = require('../Models/Provider');
const Purchase = require('../../Purchase/Models/Purchase');
const Helper = require('../../System/Helpers');
const Money = require('../../System/Money');
const { Op } = require("sequelize");
const path = require('path');
const fs = require('fs');
const Product = require('../Models/Product');




const ProviderController = {
    getCreationView: (req, res) => {
        res.render('Inventory/Provider/create', { pageTitle: 'Registrar un nuevo Proveedor / Transportista' });
    },
    createProvider: async (req, res) => {
        let data = req.body;
        let message = null;

        if (!data.isLocal) {
            data.nit = "";
            data.nrc = "";
            data.isRetentionAgent = false;
            data.classification = 'ninguno';
        }

        if (data.name.length < 2) {
            message = 'Por favor, proporcione el nombre del proveedor';
        } else if (data.classification != 'ninguno' && !Helper.verify_NRC(data.nrc)) {
            message = 'No ha proporcionado el número de registro de contribuyente';
        }/* else if (data.isLocal && data.classification == 'ninguno' && !Helper.verify_DUI(data.nit)) {
            message = 'Si el proveedor es local y no está clasificado, debe proporcionar como mínimo el número de DUI';
        } */else if (data.phone.length < 5 && data.email.length < 5) {
            message = 'Proporcione el numero de contacto del proveedor';
        }

        //validar que el nombre no este registrado
        let occurency = await Provider.findAll({ where: { name: data.name } });
        message = Object.keys(occurency).length > 0 ? 'Ya hay un Proveedor registrado con este nombre' : message;

        //Validar el numero del contacto
        if (message === null && data.phone.length > 5) {
            occurency = await Provider.findAll({ where: { phone: data.phone } });
            message = Object.keys(occurency).length > 0 ? 'Ya hay un Proveedor registrado con este numero de contacto, por favor verifique los datos' : null;
        }

        //Validar el correo de contacto
        if (message === null && data.email.length > 5) {
            occurency = await Provider.findAll({ where: { email: data.email } });
            message = Object.keys(occurency).length > 0 ? 'Ya hay un Proveedor registrado con este correo, por favor verifique los datos' : null;
        }

        //validar que no haya ningun registro con el mismo numero de registro
        if (message === null && Helper.verify_NRC(data.nrc)) {
            occurency = await Provider.findAll({ where: { NRC: data.nrc } });
            message = Object.keys(occurency).length > 0 ? 'Ya hay un Proveedor registrado con este numero de Registro, por favor verifique los datos' : null;
        }

        //validar que no haya ningun registro con el mismo numero de DUI
        if (message === null && Helper.verify_DUI(data.nit)) {
            occurency = await Provider.findAll({ where: { NIT_DUI: data.nit } });
            message = Object.keys(occurency).length > 0 ? 'Ya hay un Proveedor registrado con este numero de DUI, por favor verifique los datos' : null;
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
                    image_name = 'pr_' + Helper.generateNameForUploadedFile() + '.jpg';
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
                /**
                 * Despues de todas las verificaciones, guardar el proveedor
                 */


                const provider = await Provider.create({
                    name: data.name,
                    type: data.type,
                    NIT_DUI: data.nit,
                    NRC: data.nrc,
                    image: image_name,
                    isLocal: data.isLocal,
                    isRetentionAgent: data.isRetentionAgent,
                    classification: data.classification,
                    createdBy: 'Luis Rivera',
                    web: data.webpage,
                    phone: data.phone,
                    email: data.email,
                    direction: data.direction
                });
                res.json({
                    status: 'success',
                    data: provider.id,
                });
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: error.message,
                });
            }
        }
    },
    getProvidersView: (req, res) => {
        res.render('Inventory/Provider/allprovider', { pageTitle: 'Proveedores Registrados' });
    },
    searchProvider: async (req, res) => {
        let params = req.query;
        var query_options = {};

        //Si hay terminos de busqueda, lo agregamos a la SQL
        if (params.search !== undefined && params.search.length > 3) {
            query_options.where = {
                [Op.or]: [
                    { name: { [Op.substring]: params.search } },
                    { NRC: { [Op.substring]: params.search } },
                    { phone: { [Op.substring]: params.search } },
                    { NIT_DUI: { [Op.substring]: params.search } },
                    { email: { [Op.substring]: params.search } },
                ]
            }
        }

        //Si Hay parametros de Ordenamiento
        if (params.order !== undefined) {
            query_options.order = [[params.order, params.dir],];
        } else {
            query_options.order = [['id', 'ASC'],];
        }
        try {
            let result = {
                params: params,
            };
            result.total_rows = query_options;
            result.total_rows.col = 'id';
            result.total_rows = await Provider.count(result.total_rows);

            query_options.offset = parseInt(params.offset);
            query_options.limit = parseInt(params.limit);
            result.data = await Provider.findAll(query_options);

            //Formatear y regresar el arreglo
            return res.json(result);
        } catch (error) {
            return res.status(500).json({ 'error': 'Internal Server Error' });
        }

    },

    getProvider: async (req, res) => {

        let provider = await Provider.findByPk(req.params.id);
        if (provider === null) {
            return res.status(404);
        }

        let purchasesQty = 10;
        let purchasesAmount = Money.money_format(15000);
        let providerBalance = Money.money_format(500);
        let productQty = 132;

        res.json({
            purchasesQty,
            purchasesAmount,
            providerBalance,
            provider,
            productQty,
            pageTitle: provider.name,
        });


    },
    viewProvider: async (req, res) => {
        let provider = await Provider.findByPk(req.params.id);
        if (provider === null) {
            return res.status(404);
        }

        let purchases = await Purchase.findAll({
            where: { provider: provider.id },
            order: [['invoice_date', 'DESC']],
        });
        let purchasesAmount = 0.00;
        //recorrer las compras y sacar el monto
        purchases.forEach(purchase => {
            purchasesAmount += purchase.amount;
        });

        let productQty = await Product.count({ where: { provider: provider.id } });

        res.render('Inventory/Provider/view', {
            purchasesQty: provider.numberOfPurchase,
            providerBalance: Money.money_format(provider.balance),
            provider,
            productQty,
            pageTitle: provider.name,
            purchasesAmount: Money.money_format(purchasesAmount),
        });

    },
    updateProvider: async (req, res) => {
        let data = req.body;
        let message = null;



        if (!data.isLocal) {
            data.nit = "";
            data.nrc = "";
            data.isRetentionAgent = false;
            data.classification = 'ninguno';
        }

        if (data.name.length < 2) {
            message = 'Por favor, proporcione el nombre del proveedor';
        } else if (data.classification != 'ninguno' && !Helper.verify_NRC(data.nrc)) {
            message = 'No ha proporcionado el número de registro de contribuyente';
        } /*else if (data.isLocal && data.classification == 'ninguno' && !Helper.verify_DUI(data.nit)) {
            message = 'Si el proveedor es local y no está clasificado, debe proporcionar como mínimo el número de DUI';
        }*/ else if (data.phone.length < 5 && data.email.length < 5) {
            message = 'Proporcione el numero de contacto del proveedor';
        }
        try {
            //Buscar el proveedor
            var provider = await Provider.findByPk(data.id);
            if (provider) {
                console.log(provider);
                //validar que el nombre no este registrado
                let occurency = await Provider.findAll({
                    where: {
                        [Op.and]: {
                            name: data.name,
                            [Op.not]: { id: data.id }
                        }
                    },
                    col: 'id',
                });
                message = Object.keys(occurency).length > 0 ? 'Ya hay un Proveedor registrado con este nombre' : message;

                //Validar el numero del contacto
                if (message === null && data.phone.length > 5) {
                    // occurency = await Provider.findAll({ where: { phone: data.phone } });
                    let occurency = await Provider.findAll({
                        where: {
                            [Op.and]: {
                                phone: data.phone,
                                [Op.not]: { id: data.id }
                            }
                        },
                        col: 'id',
                    });
                    message = Object.keys(occurency).length > 0 ? 'Ya hay un Proveedor registrado con este numero de contacto, por favor verifique los datos' : null;
                }

                //Validar el correo de contacto
                if (message === null && data.email.length > 5) {
                    // occurency = await Provider.findAll({ where: { email: data.email } });
                    let occurency = await Provider.findAll({
                        where: {
                            [Op.and]: {
                                email: data.email,
                                [Op.not]: { id: data.id }
                            }
                        },
                        col: 'id',
                    });
                    message = Object.keys(occurency).length > 0 ? 'Ya hay un Proveedor registrado con este correo, por favor verifique los datos' : null;
                }

                //validar que no haya ningun registro con el mismo numero de registro
                if (message === null && Helper.verify_NRC(data.nrc)) {
                    // occurency = await Provider.findAll({ where: { NRC: data.nrc } });
                    let occurency = await Provider.findAll({
                        where: {
                            [Op.and]: {
                                NRC: data.nrc,
                                [Op.not]: { id: data.id }
                            }
                        },
                        col: 'id',
                    });
                    message = Object.keys(occurency).length > 0 ? 'Ya hay un Proveedor registrado con este numero de Registro, por favor verifique los datos' : null;
                }

                //validar que no haya ningun registro con el mismo numero de DUI
                if (message === null && Helper.verify_DUI(data.nit)) {
                    // occurency = await Provider.findAll({ where: { NIT_DUI: data.nit } });
                    let occurency = await Provider.findAll({
                        where: {
                            [Op.and]: {
                                NIT_DUI: data.nit,
                                [Op.not]: { id: data.id }
                            }
                        },
                        col: 'id',
                    });
                    message = Object.keys(occurency).length > 0 ? 'Ya hay un Proveedor registrado con este numero de DUI, por favor verifique los datos' : null;
                }


                if (message !== null) {
                    res.json({
                        status: 'errorMessage',
                        message: message,
                    });
                } else {

                    /**Guardar la imagen si es que ha sido enviada */
                    let image_name = provider.image;
                    if (data.image.length > 1) {
                        image_name = Helper.generateNameForUploadedFile() + '.jpg';
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
                    /**
                     * Despues de todas las verificaciones, guardar el proveedor
                     */
                    provider.name = data.name;
                    provider.type = data.type;
                    provider.NIT_DUI = data.nit;
                    provider.NRC = data.nrc;
                    provider.image = image_name;
                    provider.isLocal = data.isLocal;
                    provider.isRetentionAgent = data.isRetentionAgent;
                    provider.classification = data.classification;
                    provider.web = data.webpage;
                    provider.phone = data.phone;
                    provider.email = data.email;
                    provider.direction = data.direction;
                    // As above, the database still has "Jane" and "green"
                    await provider.save();

                    res.json({
                        status: 'success',
                        data: 'saved!',
                    });

                }
            } else {
                return res.json({
                    status: 'errorMessage',
                    message: 'Provider not Found',
                });
            }

        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message,
            });
        }


    },
    deleteProvider: (req, res) => {
        //Verifica si un product no tiene  registros y lo elimina
        //En caso de tener registros envia un mensaje de prohibido
    },
    incativeProvider: (req, res) => {
        //softDelete a prodcut when this have a registers
    },

    getProviderToSelect2: async (req, res) => {
        let searchLimit = 15;
        let search = req.query.search;
        try {
            let providers = await Provider.findAll({
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
            /** Select id, id as value, name as label from providers where name like '%search%' order by name asc limit x */
            return res.json(providers);
        } catch (error) {
            return res.status(500).json({ 'error': 'Internal Server Error' });
        }


    }
};

module.exports = ProviderController;