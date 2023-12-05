const Client = require('../Models/Client');
const ClientObservation = require('../Models/ClientObservation');
const Sale = require('../Models/Sale');
const SaleDetail = require('../Models/SaleDetail');
const Provider = require("../../Inventory/Models/Provider");

const Employee = require('../../HRM/Models/Employee');
const { Op } = require("sequelize");
const Helper = require('../../System/Helpers');
const sequelize = require('../../DataBase/DataBase');
const Product = require('../../Inventory/Models/Product');
const Sucursal = require('../../Inventory/Models/Sucursal');


const ClientController = {


    getClientsView: (req, res) => {
        res.render('CRM/Client/clients', { pageTitle: 'Cliente Registrados' });
    },

    clientsToDataTable: async (req, res) => {
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
                ]
            }
        }

        //Si Hay parametros de Ordenamiento
        if (params.order !== undefined) {
            query_options.order = [[params.order, params.dir],];
        } else {
            query_options.order = [['name', 'ASC'], ['id', 'ASC'],];
        }
        try {
            let result = {
                params: params,
            };
            result.total_rows = query_options;
            result.total_rows.col = 'id';
            result.total_rows = await Client.count(result.total_rows);

            query_options.offset = parseInt(params.offset);
            query_options.limit = parseInt(params.limit);
            result.data = await Client.findAll(query_options);

            //Formatear y regresar el arreglo
            return res.json(result);
        } catch (error) {
            return res.status(500).json({ 'error': 'Internal Server Error' });
        }


    },

    getCreationView: async (req, res, next) => {
        let sellers = await Employee.findAll({ where: { isSeller: 1 } }).catch(e => next(e));
        res.render('CRM/Client/create', { pageTitle: 'Registrar un nuevo Cliente', sellers });
    },

    createClient: async (req, res) => {
        let data = req.body;
        let message = null;

        if (data.name.length < 2) {
            message = 'Por favor, proporcione el nombre del Cliente';
        } else if (data.phone.length < 8) {
            message = 'Debe proporcionar un numero Telefónico del Cliente';
        }

        let occurency = null;
        if (message === null) {
            occurency = await Client.findAll({ where: { name: data.name } });
            message = Object.keys(occurency).length > 0 ? 'Ya hay un Cliente registrado con este nombre exacto, Por favor utilice el buscador de la sección Clientes antes de intentar duplicar un registro' : null;
        }

        //Validar el numero telefonico
        if (message === null) {
            occurency = await Client.findAll({ where: { phone: data.phone } });
            message = Object.keys(occurency).length > 0 ? 'Ya hay un cliente registrado con este número Telefónico' : null;
        }

        // Verificar el numero de DUI
        if (message === null && data.dui.length > 0) {
            occurency = await Client.findAll({ where: { NIT_DUI: data.dui } });
            message = Object.keys(occurency).length > 0 ? 'Ya hay un cliente registrado con este número de DUI o NIT' : null;
        }

        //Verificar el numero de NRC
        if (message === null && data.nrc.length > 0) {
            occurency = await Client.findAll({ where: { NRC: data.nrc } });
            message = Object.keys(occurency).length > 0 ? 'Ya hay un cliente registrado con este número de Registro (NRC)' : null;
        }


        //Verificar el Correo electronico
        if (message === null && data.mail.length > 0) {
            occurency = await Client.findAll({ where: { email: data.mail } });
            message = Object.keys(occurency).length > 0 ? 'Ya hay un cliente registrado con este correo electrónico' : null;
        }


        if (message !== null) {
            res.json({
                status: 'errorMessage',
                message: message,
            });
        } else {
            try {

                const client = await Client.create({
                    name: data.name,
                    type: data.type,
                    NIT_DUI: data.dui.length > 0 ? data.dui : null,
                    NRC: data.nrc.length > 0 ? data.nrc : null,
                    isLocal: data.isLocal,
                    isRetentionAgent: data.classification === 'gran',
                    classification: data.classification,
                    createdBy: 'Luis Rivera',
                    phone: data.phone,
                    email: data.mail.length > 0 ? data.mail : null,
                    direction: data.direction.length > 0 ? data.direction : null,
                    balance: 0.00,
                    seller: data.seller
                }).catch(err => next(err));;
                res.json({
                    status: 'success',
                    data: client.id,
                });
            } catch (error) {
                console.log(error)
                res.status(500).json({
                    status: 'error',
                    message: error.message,
                });
            }
        }

    },

    updateClient: async (req, res) => {
        let data = req.body;
        let client = await Client.findByPk(data.client).catch(err => next(err));

        if (client) {
            let for_update = {}
            let other = 0;
            let comment = `<p>Se Realizaron los Siguientes Cambios: </p>`;
            //validar si el nombre ha cambiado y si ha cambiado validar que no haya otro cliente con el mismo nombre
            if (client.name != data.name) {
                other = await Client.count({
                    where: {
                        [Op.and]: [
                            { id: { [Op.not]: client.id, } },
                            { name: data.name },
                        ],
                    }
                }).catch(err => next(err));

                if (other > 0) {
                    return res.json({ status: 'errorMessage', message: 'Ya hay otro Cliente con este nombre' });
                } else {
                    for_update.name = data.name;
                    comment += `<p>Nombre Anterior:  ${client.name}</p>`;
                }
            }
            //validar si el telefono ha cambiado y si ha cambiado validar que no haya otro cliente con el mismo nombre
            if (client.phone != data.phone) {
                other = await Client.count({
                    where: {
                        [Op.and]: [
                            { id: { [Op.not]: client.id, } },
                            { phone: data.phone },
                        ],
                    }
                }).catch(err => next(err));

                if (other > 0) {
                    return res.json({ status: 'errorMessage', message: 'Ya hay otro Cliente con este numero Telefonico' });
                } else {
                    for_update.phone = data.phone;
                    comment += `<p>Telefono Anterior:  ${client.phone}</p>`;
                }
            }

            if (client.email != data.email && data.email != "") {
                other = await Client.count({
                    where: {
                        [Op.and]: [
                            { id: { [Op.not]: client.id, } },
                            { email: data.email },
                        ],
                    }
                }).catch(err => next(err));

                if (other > 0) {
                    return res.json({ status: 'errorMessage', message: 'Ya hay otro Cliente con este Email' });
                } else {
                    for_update.email = data.email;
                    comment += client.email !== '' && client.email !== "" ? `<p>Email Anterior:  ${client.email}</p><br>` : `<p>Se agrego Email</p>`;
                }
            }

            //validar los demas cambios

            if (client.NRC != data.nrc && data.nrc != "") {
                other = await Client.count({
                    where: {
                        [Op.and]: [
                            { id: { [Op.not]: client.id, } },
                            { NRC: data.nrc },
                        ],
                    }
                }).catch(err => next(err));

                if (other > 0) {
                    return res.json({ status: 'errorMessage', message: 'Ya hay otro Cliente con este Numero de Registro' });
                } else {
                    for_update.NRC = data.nrc;
                    comment += client.NRC !== '' && client.NRC !== "" ? `<p>Numero de Registro Anterior:  ${client.NRC}</p>` : `<p>Se agrego Numero de Registro</p>`;
                }
            }

            if (client.NIT_DUI != data.dui && data.dui != "") {
                other = await Client.count({
                    where: {
                        [Op.and]: [
                            { id: { [Op.not]: client.id, } },
                            { NIT_DUI: data.dui },
                        ],
                    }
                }).catch(err => next(err));

                if (other > 0) {
                    return res.json({ status: 'errorMessage', message: 'Ya hay otro Cliente con este numero de DUI' });
                } else {
                    for_update.NIT_DUI = data.dui;
                    comment += client.NIT_DUI !== '' && client.NIT_DUI !== "" ? `<p>NIT/DUI Anterior:  ${client.NIT_DUI}</p>` : `<p>Se agrego NIT/DUI</p>`;
                }
            }

            if (client.type !== data.type) {
                for_update.type = data.type;
                comment += client.type !== 'minor' ? `<p>Cambio de Comprador al detalle, a ser comprador Mayorista</p>` : `<p>Cambio de Comprador Mayorista, a ser comprador al detalle</p>`;
            }
            if (client.isLocal !== data.isLocal) {
                for_update.isLocal = data.isLocal;
            }
            if (client.classification !== data.classification) {
                for_update.classification = data.classification;
                comment += `<p>Se actualizo la Classificación del Cliente</p>`;
            }
            if (client.direction !== data.direction) {
                for_update.direction = data.direction;
                comment += `<p>Direccion Anterior: ${client.direction}</p>`;
            }
            if (client.seller !== data.seller) {
                for_update.seller = data.seller;
                comment += `<p>Se actualizo el vendedor asignado</p>`;
            }

            //guardar los cambios

            let message = 'Nada que actualizar';
            if (Object.keys(for_update).length > 0) {
                client.set(for_update);
                await client.save().catch(err => next(err));

                let observation = await ClientObservation.create({
                    client: client.id,
                    createdBy: req.session.userSession.shortName,
                    observation: comment,
                });

                message = 'Actualizado';
            }

            return res.json({
                status: 'success',
                data: client,
                message
            });
        }
        return Helper.notFound(req, res, 'Client not Found');
    },

    getClient: async (req, res) => {
        let cliente = await Client.findByPk(req.params.id);
        return cliente !== null ? res.json(cliente) : res.status(404).send('Client not found');
    },

    viewClient: async (req, res, next) => {
        let cliente = await Client.findByPk(req.params.id).catch(e => next(e));
        if (cliente) {
            let notes = await ClientObservation.findAll({
                where: { client: req.params.id },
                order: [['id', 'DESC'],],
            }).catch(e => next(e));

            let seller = cliente.seller !== null ? await Employee.findByPk(cliente.seller).catch(err => next(err)) : { name: 'Ningun Vendedor asignado' };
            let sellers = await Employee.findAll({ where: { isSeller: 1 } }).catch(err => next(err));

            //buscar las ordenes finalizadas

            let finalized = await Sale.findAll({
                where: {
                    [Op.and]: [
                        { _status: { [Op.not]: 'process' } },
                        { client: cliente.id },
                    ],
                },
                order: [['id', 'DESC']],
            });

            let in_process = await Sale.findOne({
                where: {
                    [Op.and]: [
                        { _status: 'process' },
                        { client: cliente.id },
                    ],
                },
                order: [['id', 'DESC']],
            });
            let _status = {
                'process': 'Orden Abierta',
                'prepared': 'Paquete Armado',
                'transport': 'Paquete en ruta',
                'delivered': 'Entregado, Remuneración pendiente',
                'collected': 'Remuneración recibida',
                'revoking': 'Solicitud de Liberacion',
                'revoked': 'Orden cancelada',
                'delivery_failed': 'Entrega Fallida',
                'to_resend': 'Para Reenvio',
                'closed': 'Orden cerrada / En espera de preparación',
            }
            let in_process_details = [];
            let indexed_details = {};
            if (in_process !== null) {
                in_process_details = await SaleDetail.findAll({ where: { sale: in_process.id } }).catch(err => next(err));
                for (let index = 0; index < in_process_details.length; index++) {
                    if (in_process_details[index].product != null) {
                        in_process_details[index].product = await Product.findByPk(in_process_details[index].product, { raw: true, attributes: ['id', 'name', 'image'] }).catch(err => next(err));
                    }
                    indexed_details[in_process_details[index].id] = in_process_details[index];
                }
            }

            let providers = await Provider.findAll({ where: { type: 'transport' } });
            let locations = {};
            providers.forEach(prov => {
                if (prov.delivery_locations !== null) {
                    locations[prov.id] = prov.delivery_locations;
                }
            });
            let sucursals = await Sucursal.findAll();

            //buscar las ordenes en proceso
            return res.render('CRM/Client/view', {
                pageTitle: cliente.name,
                cliente,
                sellers,
                notes,
                seller,
                in_process,
                finalized,
                in_process_details,
                indexed_details,
                UserSucursal: req.session.userSession.employee.sucursal,
                providers,
                locations,
                _status,
                sucursals
            });
        }
    },

    updateClientData: async (req, res) => {
        let data = req.body;
        let client = await Client.findByPk(data.client);
        if (client == null) { Helper.notFound(req, res, 'Client not Found'); }

        switch (data.case) {
            case 'note':
                if (data.note.length < 10) { return res.json({ status: 'errorMessage', message: 'Agregue contenido a la nota' }); }
                let observation = await ClientObservation.create({
                    client: data.client,
                    createdBy: req.session.userSession.shortName,
                    observation: data.note,
                }).catch(e => next(e));
                return res.json({
                    status: 'success',
                    data: observation,
                });
                break;
            default:
                break;
        }

        return res.json({ status: 'errorMessage', message: 'Opcion no valida' });
    },

    getClientOrders: async (req, res) => {

        //paginacion simple de ordenes
        let total = 100,
            limit = 10,
            page = 1;

        //Pendiente
        let array = {
            data: [
                [
                    '# Orden',
                    'Total',
                    'Estado',
                    'Tipo de Envio',
                    'Fecha de la Orden',
                ],
                [
                    '# Orden',
                    'Total',
                    'Estado',
                    'Tipo de Envio',
                    'Fecha de la Orden',
                ], [
                    '# Orden',
                    'Total',
                    'Estado',
                    'Tipo de Envio',
                    'Fecha de la Orden',
                ]
            ]
        };

        return res.json(array);

    },
    getClientToSelect2: async (req, res) => {

        let searchLimit = 15;
        let search = req.query.search;
        try {

            let clients = await Client.findAll({
                where: {
                    [Op.or]: [
                        { name: { [Op.substring]: search } },
                        { NIT_DUI: { [Op.substring]: search } },
                        { NRC: { [Op.substring]: search } },
                        { phone: { [Op.substring]: search } },
                    ],
                },
                order: [
                    ['name', 'ASC'],
                ],
                limit: searchLimit,
                raw: true,
            });


            return res.json(clients.map(el => {
                return {
                    value: el.id,
                    label: el.name,
                    client: el
                }
            }));
            /** Select id, id as value, name as label from providers where name like '%search%' order by name asc limit x */
            // return res.json(products);
        } catch (error) {
            console.log(error.message)
            return res.status(500).json({ 'error': 'Internal Server Error' });
        }
    },
};

module.exports = ClientController;