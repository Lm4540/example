const Client = require('../Models/Client');
const ClientObservation = require('../Models/ClientObservation');
const Sale = require('../Models/Sale');
const SaleDetail = require('../Models/SaleDetail');
const Provider = require("../../Inventory/Models/Provider");

const Employee = require('../../HRM/Models/Employee');
const { Op, QueryTypes } = require("sequelize");
const Helper = require('../../System/Helpers');
const sequelize = require('../../DataBase/DataBase');
const Product = require('../../Inventory/Models/Product');
const Sucursal = require('../../Inventory/Models/Sucursal');
const SalePayment = require('../Models/SalePayment');



const ClientController = {


    getClientsView: (req, res) => {
        return res.render('CRM/Client/clients', { pageTitle: 'Cliente Registrados' });
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
            console.log(error);
            return res.status(500).json({ 'error': 'Internal Server Error' });
        }


    },

    getCreationView: async (req, res, next) => {
        let sellers = await Employee.findAll({ where: { isSeller: 1 } }).catch(e => next(e));
        let distritos = require('../../DTE/Catalogos/distritos.json').values;
        let municipios = require('../../DTE/Catalogos/CAT-013.json').items;
        let departamentos = require('../../DTE/Catalogos/CAT-012.json').items;
        let dptos = JSON.stringify(require('../../DTE/Catalogos/direction.json'));
        let dis = JSON.stringify(require('../../DTE/Catalogos/distritos_.json'));
        let giros = require('../../DTE/Catalogos/CAT-019.json').items;
        return res.render('CRM/Client/create', { pageTitle: 'Registrar un nuevo Cliente', sellers, distritos, municipios, departamentos, dptos, dis, giros });
    },

    createClient: async (req, res) => {
        let data = req.body;
        let existe = null;
        if (data.name.length < 2) {
            return res.json({
                status: 'errorMessage',
                message: 'Por favor, proporcione el nombre del Cliente',
            });
        } else if (data.phone.length < 8) {
            return res.json({
                status: 'errorMessage',
                message: 'Debe proporcionar un numero Telefónico del Cliente',
            });
        }

        if (data.documentType != null) {
            if (data.dui.length < 3) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Debe proporcionar un numero de documento para este Cliente',
                });
            }

            existe = await Client.findOne({
                where: {
                    NIT_DUI: data.dui,
                    tipoDocumento: data.documentType
                }
            });

            if (existe) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Ya hay un cliente registrado con este tipo y numero de documento',
                });
            }
        }


        if (data.classification !== null) {
            if (data.nrc.length < 3) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Debe proporcionar un numero de registro para este Cliente',
                });

            } else if (data.direction.trim().length < 3) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Debe proporcionar la dirección para este Cliente',
                });

            }

            existe = await Client.findOne({ where: { NRC: data.nrc } });
            if (existe) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Ya hay un cliente registrado con este número de Registro (NRC)',
                });
            }
        }

        existe = await Client.findOne({ where: { name: data.name } });
        if (existe) {
            return res.json({
                status: 'errorMessage',
                message: 'Ya hay un Cliente registrado con este nombre exacto, Por favor utilice el buscador de la sección Clientes antes de intentar duplicar un registro',
            });
        }

        existe = await Client.findOne({ where: { phone: data.phone } });
        if (existe) {
            return res.json({
                status: 'errorMessage',
                message: 'Ya hay un Cliente registrado con este número de teléfono exacto',
            });
        }

        //Verificar el Correo electronico
        if (data.mail.length > 0) {
            existe = await Client.findOne({ where: { email: data.mail } });
            if (existe) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Ya hay un cliente registrado con este correo electrónico',
                });
            }
        }

        let _seller = data.seller ?? req.session.userSession.employee.id;
        let _sucursal = null;

        if (_seller == req.session.userSession.employee.id) {
            _sucursal = req.session.userSession.employee.sucursal;
        } else {
            let _seller_ = await Employee.findByPk(_seller);
            if (_seller_) {
                _sucursal = _seller_.sucursal;
            }
        }

        try {
            const client = await Client.create({
                name: data.name,
                type: data.type,
                NIT_DUI: data.dui.length > 0 ? data.dui : null,
                NRC: data.nrc !== null && data.nrc.length > 0 ? data.nrc : null,
                isLocal: data.isLocal,
                isRetentionAgent: data.classification === 'gran',
                classification: data.classification,
                createdBy: req.session.userSession.employee.shortName,
                phone: data.phone,
                email: data.mail.length > 0 ? data.mail : '',
                direction: data.direction.length > 0 ? `Distrito de ${data.distrito}, ${data.direction}` : 'No Registrado',
                seller: _seller,
                tipoDocumento: data.documentType,
                sucursal: _sucursal,
                departamento: data.departamento,
                municipio: data.municipio,
                giro: data.giro,
                codActividad: data.codActividad,
                nombreComercial: data.nombreComercial,
            });

            return res.json({
                status: 'success',
                data: client.id,
            });
        } catch (error) {
            console.log(error)
            return res.status(500).json({
                status: 'error',
                message: error.message,
            });
        }
    },

    editClient: async (req, res) => {
        let cliente = await Client.findByPk(req.params.id);
        if (cliente) {
            let sellers = await Employee.findAll({ where: { isSeller: 1 } }).catch(e => next(e));
            let municipios = require('../../DTE/Catalogos/CAT-013.json').items;
            let departamentos = require('../../DTE/Catalogos/CAT-012.json').items;
            let dptos = JSON.stringify(require('../../DTE/Catalogos/direction.json'));
            let giros = require('../../DTE/Catalogos/CAT-019.json').items;
            return res.render('CRM/Client/edit', { pageTitle: 'Editando: ' + cliente.name, cliente, sellers, municipios, departamentos, dptos, giros });
        }

        return Helper.notFound(req, res, 'Client not Found')
    },

    updateClient: async (req, res) => {
        let data = req.body;
        let client = await Client.findByPk(data.client);
        try {
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
                    });

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
                    });

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
                    });

                    if (other > 0) {
                        return res.json({ status: 'errorMessage', message: 'Ya hay otro Cliente con este Email' });
                    } else {
                        for_update.email = data.email;
                        comment += client.email !== '' && client.email !== "" ? `<p>Email Anterior:  ${client.email}</p><br>` : `<p>Se agrego Email</p>`;
                    }
                }

                //validar el tipo de documento
                if (data.documentType !== null) {
                    if (data.dui.length < 3) {
                        return res.json({ status: 'errorMessage', message: 'Debe proporcionar un numero de documento para este Cliente' });
                    }
                    other = await Client.count({
                        where: {
                            [Op.and]: [
                                { id: { [Op.not]: client.id, } },
                                { tipoDocumento: data.documentType },
                                { NIT_DUI: data.dui }
                            ],
                        }
                    });

                    if (other > 0) {
                        return res.json({ status: 'errorMessage', message: 'Ya hay otro Cliente con este tipo y numero de documento' });
                    }

                    for_update.tipoDocumento = data.documentType;
                    for_update.NIT_DUI = data.dui;
                    comment += `<p>Se cambio el Tipo y numero de Documento</p>`;
                } else {
                    for_update.documentType = null;
                    for_update.NIT_DUI = null;
                }






                if (client.NRC != data.nrc && data.nrc != "") {
                    other = await Client.count({
                        where: {
                            [Op.and]: [
                                { id: { [Op.not]: client.id, } },
                                { NRC: data.nrc },
                            ],
                        }
                    });

                    if (other > 0) {
                        return res.json({ status: 'errorMessage', message: 'Ya hay otro Cliente con este Numero de Registro' });
                    } else {
                        for_update.NRC = data.nrc;
                        comment += client.NRC !== '' && client.NRC !== "" ? `<p>Numero de Registro Anterior:  ${client.NRC}</p>` : `<p>Se agrego Numero de Registro</p>`;
                    }
                }


                if (client.isLocal !== data.isLocal) {
                    for_update.isLocal = data.isLocal;
                    if (!data.isLocal) {
                        for_update.direction = data.direction;
                        for_update.departamento = "00";
                        for_update.municipio = "00";

                    }
                }
                if (client.direction !== data.direction) {
                    for_update.direction = data.direction;
                    comment += `<p>Direccion Anterior: ${client.direction}`;
                    if (client.departamento !== data.departamento) {
                        for_update.departamento = data.departamento;
                        for_update.municipio = data.municipio;
                        comment += `Depratamento ${client.departamento} y Municipio ${client.municipio}`;
                    }
                    comment += `</p>`;
                } else if (client.departamento !== data.departamento) {
                    for_update.departamento = data.departamento;
                    for_update.municipio = data.municipio;
                }

                if (client.seller != data.seller) {
                    for_update.seller = data.seller;
                    comment += `<p>Se actualizo el vendedor asignado</p>`;
                }

                if (client.classification !== data.classification) {
                    for_update.classification = data.classification;
                    comment += `<p>Se actualizo la Classificación del Cliente</p>`;

                    if (data.classification == 'ninguno') {
                        for_update.codActividad = null;
                        for_update.giro = null;
                        for_update.nombreComercial = null;

                    } else {
                        if (client.codActividad !== data.codActividad) {
                            for_update.codActividad = data.codActividad;
                            for_update.giro = data.giro;
                            comment += `<p>Se actualizo el Giro de la empresa cliente</p>`;
                        }

                        if (for_update.nombreComercial !== data.nombreComercial) {
                            for_update.nombreComercial = data.nombreComercial;
                            comment += `<p>Se actualizo el nombre Comercial</p>`;
                        }
                    }
                }
                //guardar los cambios
                let message = 'Nada que actualizar';
                if (Object.keys(for_update).length > 0) {
                    client.set(for_update);
                    await client.save();

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
        } catch (error) {
            return res.json({ status: 'errorMessage', message: 'Ha ocurrido un error, por favor recarga la página he inténtalo nuevamente', error: error.message });
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
            let sellers = await Employee.findAll({
                where: { isSeller: true }
            });

            //buscar las ordenes finalizadas

            let finalized = await Sale.findAll({
                where: {
                    [Op.and]: [
                        { _status: { [Op.not]: 'process' } },
                        { client: cliente.id },
                    ],
                },
                order: [['createdAt', 'DESC']],
                limit: 5,
            });

            let hay_mas_ventas = await Sale.count({
                where: {
                    [Op.and]: [
                        { _status: { [Op.not]: 'process' } },
                        { client: cliente.id },
                    ],
                },
                order: [['createdAt', 'DESC']],
            });

            hay_mas_ventas = hay_mas_ventas > 5;

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
                in_process_details = await SaleDetail.findAll({ where: { sale: in_process.id } });
                for (let index = 0; index < in_process_details.length; index++) {
                    if (in_process_details[index].product != null) {
                        in_process_details[index].product = await Product.findByPk(in_process_details[index].product, { raw: true, attributes: ['id', 'name', 'image'] });
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

            let payments = await sequelize.query(`SELECT sum(amount) as pay, sum(asigned_amount) as asigned FROM crm_sale_payment WHERE client = ${cliente.id}`, {
                type: QueryTypes.SELECT
            });
            let a_favor = 0.00;
            if (payments !== null && payments.length > 0) {
                a_favor = Number.parseFloat(payments[0].pay) - Number.parseFloat(payments[0].asigned);
            }

            payments = await SalePayment.findAll({
                limit: 5,
                where: {
                    client: cliente.id
                }, order: [
                    ['id', 'DESC'],
                ],
            });


            let hay_mas_pagos = await SalePayment.count({
                where: {
                    client: cliente.id
                }, order: [
                    ['id', 'DESC'],
                ]
            });

            hay_mas_pagos = hay_mas_pagos > 5;

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
                sucursals,
                payments,
                hay_mas_pagos,
                hay_mas_ventas,
                a_favor
            });
        }

        return Helper.notFound(req, res, 'Client not Found')
    },

    viewClientSales: async (req, res, next) => {
        let client = req.params.id;
        let last_id = req.params.last;
        let limit = Number.parseInt(req.params.limit);

        let mas = await Sale.count({
            where: {
                _status: { [Op.not]: 'process' },
                client: client,
                id: {
                    [Op.lt]: last_id
                }
            },
            order: [['createdAt', 'DESC']],
        });

        let details = await Sale.findAll({
            where: {
                _status: { [Op.not]: 'process' },
                client: client,
                id: {
                    [Op.lt]: last_id
                }

            },
            order: [['createdAt', 'DESC']],
            limit: limit,
            raw: true,
        });


        return res.json({
            details: details,
            more: mas > limit,
            last: details.length > 0 ? details[details.length - 1].id : 0,
        })
    },

    viewClientPayments: async (req, res, next) => {

        let client = req.params.id;
        let last_id = req.params.last;
        let limit = Number.parseInt(req.params.limit);

        let mas = await SalePayment.count({
            where: {
                client: client,
                id: {
                    [Op.lt]: last_id
                }
            }, order: [
                ['id', 'DESC'],
            ]
        });

        let details = await SalePayment.findAll({
            where: {
                client: client,
                id: {
                    [Op.lt]: last_id
                }
            }, order: [
                ['id', 'DESC'],
            ], limit: limit,
        });


        return res.json({
            details: details,
            more: mas > limit,
            last: details.length > 0 ? details[details.length - 1].id : 0,
        })




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