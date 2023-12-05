const Sucursal = require('../Models/Sucursal');
const Helper = require('../../System/Helpers');
const { Op, QueryTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");
const Sale = require('../../CRM/Models/Sale');
const Product = require('../Models/Product');




const SucursalController = {

    createSucursal: async (req, res) => {
        let data = req.body;
        let message = null;

        if (data.name.length < 2) {
            message = 'Por favor, proporcione el nombre para la nueva Sucursal';
        } else if (data.location < 3) {
            message = 'Proporcione la dirección de la nueva sucursal';
        }

        if (message === null) {
            //validar que el nombre no este registrado
            let occurency = await Sucursal.findAll({ where: { name: data.name } });
            message = Object.keys(occurency).length > 0 ? 'Ya hay una Sucursal registrada con este nombre' : message;
        }

        //Validar el correo de contacto
        if (message === null) {
            occurency = await Sucursal.findAll({ where: { location: data.location } });
            message = Object.keys(occurency).length > 0 ? 'Ya hay una sucursal registrada con esta dirección, por favor verifique los datos' : null;
        }

        if (message !== null) {
            res.json({
                status: 'errorMessage',
                message: message,
            });
        } else {
            try {
                const sucursal = await Sucursal.create({
                    name: data.name,
                    location: data.location,
                    mapLink: data.mapLink,
                    hasAreas: false,
                    isWharehouse: true,
                    isSalesRoom: data.isSalesRoom
                });
                res.json({
                    status: 'success',
                    data: sucursal.id,
                });
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: error.message,
                });
            }
        }
    },
    getSucursalsView: async (req, res) => {
        //buscar todas las sucursales

        let sucursals = await Sucursal.findAll({
            attributes: ['name', 'location', 'mapLink', 'id']
        });
        console.log(sucursals.length);
        res.render('Inventory/Sucursal/sucursals', { pageTitle: 'Sucursales Registradas', sucursals });
    },

    getSucursal: async (req, res) => {

        let sucursal = await Sucursal.findByPk(req.params.id);
        if (sucursal === null) {
            return res.status(404);
        }




        res.json({
            sucursal,

        });


    },
    viewSucursal: async (req, res) => {
        let sucursal = await Sucursal.findByPk(req.params.id);
        if (sucursal === null) {
            return res.status(404);
        }

        let sales = await Sale.findAll({
            where: {
                [Op.and]: [
                    { _status: { [Op.ne]: 'closed' } },
                    { _status: { [Op.ne]: 'revoked' } },
                    {sucursal: sucursal.id},
                ],
            }
        });

        let clients = await sequelize.query(
            'select id, name from crm_client where sucursal = :sucursal or id in (select client from crm_sale where sucursal = :sucursal)',
            {
                replacements: { sucursal: sucursal.id },
                type: QueryTypes.SELECT,
            }
        );
        clients['indexes'] = {};
        let ClientsLen = clients.length;
        clients.forEach(element => {
            clients.indexes[element.id] = element.name;
        });

        let sellers = await sequelize.query(
            'select id, name from hrm_employee where sucursal = :sucursal and isSeller = 1',
            {
                replacements: { sucursal: sucursal.id },
                type: QueryTypes.SELECT,
            }
        );
        sellers.indexes = {};
        let SellersLen = sellers.length;

        sellers.forEach(element => {
            sellers.indexes[element.id] = element.name;
        });

        let products = await Product.findAll({
            where: {
                id: {
                    [Op.in]: sequelize.literal(`(SELECT product FROM inventory_product_stock WHERE sucursal = ${sucursal.id}) and stock - reserved > 0`), 
                }
            }
        })

        res.render('Inventory/Sucursal/sucursal', {
            sucursal,
            pageTitle: sucursal.name,
            sales,
            clients,
            sellers,
            SellersLen,
            ClientsLen,
            products
        });



    },
    getSucursals: async (req, res) => {
        tmp = await Sucursal.findAll({ attributes: ['id', 'name'] });
        return res.json(tmp)

    },
    updateSucursal: async (req, res) => {
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
        } else if (data.isLocal && data.classification == 'ninguno' && !Helper.verify_DUI(data.nit)) {
            message = 'Si el proveedor es local y no está clasificado, debe proporcionar como mínimo el número de DUI';
        } else if (data.phone.length < 5 && data.email.length < 5) {
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

};

module.exports = SucursalController;