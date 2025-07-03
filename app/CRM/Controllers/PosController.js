const cache = require('memory-cache'); // Nuevo: módulo de caché
const QRCode = require('qrcode');
const axios = require('axios');

const { Op, QueryTypes, json } = require("sequelize");


const Sucursal = require('../../Inventory/Models/Sucursal');
const Client = require("../Models/Client");
const DTEController = require('../../DTE/Controllers/DTEController');
const Sale = require('../Models/Sale');
const SaleDetail = require('../Models/SaleDetail');
const SalePayment = require('../Models/SalePayment');
const Product = require('../../Inventory/Models/Product');
const Stock = require('../../Inventory/Models/Stock');
const PettyCash = require('../../Financial/Models/PettyCash');
const Employee = require('../../HRM/Models/Employee');
const DTE_Model = require('../../DTE/Models/DTE');
const FailedDte = require('../../DTE/Models/FailedDte');
const PettyCashMoves = require('../../Financial/Models/PettyCashMoves');

const Helper = require('../../System/Helpers');
const sequelize = require("../../DataBase/DataBase");
const Provider = require('../../Inventory/Models/Provider');
const Money = require('../../System/Money');
const dteValidator = require('../../DTE/dteValidator');

const path = require('path');
const util = require('util');
const ejs_ = require("ejs");
const renderFileAsync = util.promisify(ejs_.renderFile);

const municipios = require('../../DTE/Catalogos/municipios.json');
const departamentos = require('../../DTE/Catalogos/departamentos.json');
const documentos = require('../../DTE/Catalogos/tipo_documento.json');
const VALOR_IVA = parseFloat(process.env.IVA);

const dte_types = {
    "01": "Factura",
    "03": "Comprobante de crédito fiscal",
    "04": "Nota de remisión",
    "05": "Nota de crédito",
    "06": "Nota de débito",
    "07": "Comprobante de retención",
    "08": "Comprobante de Liquidación",
    "09": "Documento contable de liquidación",
    "11": "Factura de exportación",
    "14": "Factura de sujeto excluido",
    "15": "Comprobante de donación"
};

const status = {
    'process': 'En Proceso',
    'prepared': "Paquete Preparado",
    'transport': "En Ruta",
    'delivered': 'Entregado',
    'collected': "Pago Recibido",
    'revoking': "Revocando / Liberando",
    'revoked': "Revocado",
    'delivery_failed': "Entrega Fallida",
    'to_resend': "Marcado para reenvio",
    'closed': 'Cerrado'
};

const helper_url = process.env.PDF_GENERATION_URL;


module.exports = {

    getJsonById: async (req, res) => {
        try {
            let dte = await DTE_Model.findByPk(req.params.id);
            if (dte === null) {
                return Helper.notFound(req, res, 'Documento no encontrado');
            }

            dte_json = dte.dte;
            dte_json.responseMH = dte.responseMH;
            res.attachment(dte_json.identificacion.codigoGeneracion + '.json');
            res.send(JSON.stringify(dte_json, null, 2));

        } catch (err) {
            return res.json({ status: "error", message: "", err });
        }
    },

    viewDTEinLine: async (req, res) => {
        try {
            let dte = await DTE_Model.findByPk(req.params.id);
            if (dte === null) {
                return Helper.notFound(req, res, 'Documento no encontrado');
            }

            let sucursal = await Sucursal.findByPk(dte.sucursal);
            let qrUrl = `https://admin.factura.gob.sv/consultaPublica?ambiente=${dte.dte.identificacion.ambiente}&codGen=${dte.codigo}&fechaEmi=${dte.dte.identificacion.fecEmi}`;
            let base64String = await QRCode.toDataURL(qrUrl, {
                errorCorrectionLevel: 'L', // Nivel de corrección de errores: L, M, Q, H
                type: 'image/png',         // Tipo de imagen de salida
                quality: 0.85,             // Calidad de la imagen (para JPEG)
                margin: 1,                 // Margen del código QR en unidades de módulo
                color: {
                    dark: "#000000",           // Color de los módulos oscuros (negro)
                    light: "#FFFFFF"          // Color de los módulos claros (blanco)
                }
            });

            let receptor = null;
            if (String(dte.tipo) == "14") {
                receptor = {
                    documento: dte.dte.sujetoExcluido.tipoDocumento && dte.dte.sujetoExcluido.numDocumento ? `${documentos[dte.dte.sujetoExcluido.tipoDocumento]} (${dte.dte.sujetoExcluido.numDocumento})` : "",
                    direccion: dte.dte.sujetoExcluido.direccion !== null ? `${dte.dte.sujetoExcluido.direccion.complemento}, ${municipios[dte.dte.sujetoExcluido.direccion.departamento][dte.dte.sujetoExcluido.direccion.municipio]}, ${departamentos[dte.dte.sujetoExcluido.direccion.departamento]?.toUpperCase()}` : "",
                }

            } else {
                receptor = {
                    documento: dte.dte.receptor.tipoDocumento && dte.dte.receptor.numDocumento ? `${documentos[dte.dte.receptor.tipoDocumento]} (${dte.dte.receptor.numDocumento})` : "",
                    direccion: dte.dte.receptor.direccion !== null ? `${dte.dte.receptor.direccion.complemento}, ${municipios[dte.dte.receptor.direccion.departamento][dte.dte.receptor.direccion.municipio]}, ${departamentos[dte.dte.receptor.direccion.departamento]?.toUpperCase()}` : "",
                }
            }

            let data = {
                emisor_direction: `${dte.dte.emisor.direccion.complemento}, ${municipios[dte.dte.emisor.direccion.departamento][dte.dte.emisor.direccion.municipio]}, ${departamentos[dte.dte.emisor.direccion.departamento]?.toUpperCase()}`,
                receptor: receptor
            }
            dte_json = dte.dte;
            dte_json.responseMH = dte.responseMH;
            //direccion de las vistas
            let filePath = path.join(__dirname, '..', '..', 'views', 'POS', 'pdf_views', `${dte.tipo}.ejs`);
            const html = await renderFileAsync(filePath, {
                pageTitle: `DTE ${dte.codigo}`,
                sucursal: sucursal.name,
                dte: dte_json,
                pdf_service: process.env.PDF_GENERATION_URL,
                email_service: process.env.EMAIL_SERVICE_URL,
                qrImage: base64String,
                qrUrl,
                data,
                Helper: {
                    money_format: (n, digits = 2) => {
                        return new Intl.NumberFormat('es-SV', { style: "decimal", currency: "USD", minimumFractionDigits: digits }).format(n);
                    },
                    format_date: (_date, time = true) => {
                        let date = new Date(_date);
                        // let date = new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(),  fecha.getUTCHours(), fecha.getUTCMinutes(), fecha.getUTCSeconds());
                        let day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate();
                        let month = date.getMonth() + 1;
                        month = month < 10 ? `0${month}` : month;
                        if (time) {
                            let hours = date.getHours();
                            let am = 'AM';
                            if (hours > 12) {
                                hours = hours - 12;
                                am = 'PM'
                            }
                            let minutes = date.getMinutes();
                            minutes = minutes < 10 ? `0${minutes}` : minutes;
                            return `${day}/${month}/${date.getFullYear()} ${hours}:${minutes} ${am}`;

                        }
                        return `${day}/${month}/${date.getFullYear()}`;

                    },
                },
            });
            return res.send(html);
        } catch (err) {
            return res.json({ status: "error", message: "", err });
        }
    },

    getDTEforPDF: async (req, res) => {
        try {
            let dte = await DTE_Model.findByPk(req.params.id);
            if (dte === null) {
                return Helper.notFound(req, res, 'Documento no encontrado');
            }

            let sucursal = await Sucursal.findByPk(dte.sucursal);
            let qrUrl = `https://admin.factura.gob.sv/consultaPublica?ambiente=${dte.dte.identificacion.ambiente}&codGen=${dte.codigo}&fechaEmi=${dte.dte.identificacion.fecEmi}`;
            let base64String = await QRCode.toDataURL(qrUrl, {
                errorCorrectionLevel: 'L', // Nivel de corrección de errores: L, M, Q, H
                type: 'image/png',         // Tipo de imagen de salida
                quality: 0.85,             // Calidad de la imagen (para JPEG)
                margin: 1,                 // Margen del código QR en unidades de módulo
                color: {
                    dark: "#000000",           // Color de los módulos oscuros (negro)
                    light: "#FFFFFF"          // Color de los módulos claros (blanco)
                }
            });

            let receptor = null;
            if (String(dte.tipo) == "14") {
                receptor = {
                    documento: dte.dte.sujetoExcluido.tipoDocumento && dte.dte.sujetoExcluido.numDocumento ? `${documentos[dte.dte.sujetoExcluido.tipoDocumento]} (${dte.dte.sujetoExcluido.numDocumento})` : "",
                    direccion: dte.dte.sujetoExcluido.direccion !== null ? `${dte.dte.sujetoExcluido.direccion.complemento}, ${municipios[dte.dte.sujetoExcluido.direccion.departamento][dte.dte.sujetoExcluido.direccion.municipio]}, ${departamentos[dte.dte.sujetoExcluido.direccion.departamento]?.toUpperCase()}` : "",
                }

            } else {
                receptor = {
                    documento: dte.dte.receptor.tipoDocumento && dte.dte.receptor.numDocumento ? `${documentos[dte.dte.receptor.tipoDocumento]} (${dte.dte.receptor.numDocumento})` : "",
                    direccion: dte.dte.receptor.direccion !== null ? `${dte.dte.receptor.direccion.complemento}, ${municipios[dte.dte.receptor.direccion.departamento][dte.dte.receptor.direccion.municipio]}, ${departamentos[dte.dte.receptor.direccion.departamento]?.toUpperCase()}` : "",
                }
            }

            let data = {
                emisor_direction: `${dte.dte.emisor.direccion.complemento}, ${municipios[dte.dte.emisor.direccion.departamento][dte.dte.emisor.direccion.municipio]}, ${departamentos[dte.dte.emisor.direccion.departamento]?.toUpperCase()}`,
                receptor: receptor
            }

            dte_json = dte.dte;
            dte_json.responseMH = dte.responseMH;
            //direccion de las vistas
            let filePath = path.join(__dirname, '..', '..', 'views', 'POS', 'pdf_views', `${dte.tipo}.ejs`);
            const html = await renderFileAsync(filePath, {
                pageTitle: `DTE ${dte.codigo}`,
                sucursal: sucursal.name,
                dte: dte_json,
                pdf_service: process.env.PDF_GENERATION_URL,
                email_service: process.env.EMAIL_SERVICE_URL,
                qrImage: base64String,
                qrUrl,
                data,
                Helper: {
                    money_format: (n, digits = 2) => {
                        return new Intl.NumberFormat('es-SV', { style: "decimal", currency: "USD", minimumFractionDigits: digits }).format(n);
                    },
                    format_date: (_date, time = true) => {
                        let date = new Date(_date);
                        // let date = new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(),  fecha.getUTCHours(), fecha.getUTCMinutes(), fecha.getUTCSeconds());
                        let day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate();
                        let month = date.getMonth() + 1;
                        month = month < 10 ? `0${month}` : month;
                        if (time) {
                            let hours = date.getHours();
                            let am = 'AM';
                            if (hours > 12) {
                                hours = hours - 12;
                                am = 'PM'
                            }
                            let minutes = date.getMinutes();
                            minutes = minutes < 10 ? `0${minutes}` : minutes;
                            return `${day}/${month}/${date.getFullYear()} ${hours}:${minutes} ${am}`;

                        }
                        return `${day}/${month}/${date.getFullYear()}`;

                    },
                },
            });

            // return res.json(dte_json);

            return res.send({ status: "success", data: html, dte: dte_json });
        } catch (err) {
            return res.json({ status: "error", message: "", err });
        }

    },

    getDTEPdfByCOde: async (req, res) => {
        try {
            const { uuid, fecha } = req.params;
            const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (regex.test(uuid)) { } else {

            }
            let dte = await DTE_Model.findOne({
                where: {
                    codigo: uuid,
                    createdAt: {
                        [Op.gte]: new Date(`${fecha}T00:00:00Z`),
                    }
                }
            });

            if (dte === null) {
                return Helper.notFound(req, res, 'Documento no encontrado');
            }

            let sucursal = await Sucursal.findByPk(dte.sucursal);
            let qrUrl = `https://admin.factura.gob.sv/consultaPublica?ambiente=${dte.dte.identificacion.ambiente}&codGen=${dte.codigo}&fechaEmi=${dte.dte.identificacion.fecEmi}`;
            let base64String = await QRCode.toDataURL(qrUrl, {
                errorCorrectionLevel: 'L', // Nivel de corrección de errores: L, M, Q, H
                type: 'image/png',         // Tipo de imagen de salida
                quality: 0.85,             // Calidad de la imagen (para JPEG)
                margin: 1,                 // Margen del código QR en unidades de módulo
                color: {
                    dark: "#000000",           // Color de los módulos oscuros (negro)
                    light: "#FFFFFF"          // Color de los módulos claros (blanco)
                }
            });

            let receptor = null;
            if (String(dte.tipo) == "14") {
                receptor = {
                    documento: dte.dte.sujetoExcluido.tipoDocumento && dte.dte.sujetoExcluido.numDocumento ? `${documentos[dte.dte.sujetoExcluido.tipoDocumento]} (${dte.dte.sujetoExcluido.numDocumento})` : "",
                    direccion: dte.dte.sujetoExcluido.direccion !== null ? `${dte.dte.sujetoExcluido.direccion.complemento}, ${municipios[dte.dte.sujetoExcluido.direccion.departamento][dte.dte.sujetoExcluido.direccion.municipio]}, ${departamentos[dte.dte.sujetoExcluido.direccion.departamento]?.toUpperCase()}` : "",
                }

            } else {
                receptor = {
                    documento: dte.dte.receptor.tipoDocumento && dte.dte.receptor.numDocumento ? `${documentos[dte.dte.receptor.tipoDocumento]} (${dte.dte.receptor.numDocumento})` : "",
                    direccion: dte.dte.receptor.direccion !== null ? `${dte.dte.receptor.direccion.complemento}, ${municipios[dte.dte.receptor.direccion.departamento][dte.dte.receptor.direccion.municipio]}, ${departamentos[dte.dte.receptor.direccion.departamento]?.toUpperCase()}` : "",
                }
            }

            let data = {
                emisor_direction: `${dte.dte.emisor.direccion.complemento}, ${municipios[dte.dte.emisor.direccion.departamento][dte.dte.emisor.direccion.municipio]}, ${departamentos[dte.dte.emisor.direccion.departamento]?.toUpperCase()}`,
                receptor: receptor
            }
            dte_json = dte.dte;
            dte_json.responseMH = dte.responseMH;
            //direccion de las vistas
            let filePath = path.join(__dirname, '..', '..', 'views', 'POS', 'pdf_views', `${dte.tipo}.ejs`);
            const html = await renderFileAsync(filePath, {
                pageTitle: `DTE ${dte.codigo}`,
                sucursal: sucursal.name,
                dte: dte_json,
                pdf_service: process.env.PDF_GENERATION_URL,
                email_service: process.env.EMAIL_SERVICE_URL,
                qrImage: base64String,
                qrUrl,
                data,
                Helper: {
                    money_format: (n, digits = 2) => {
                        return new Intl.NumberFormat('es-SV', { style: "decimal", currency: "USD", minimumFractionDigits: digits }).format(n);
                    },
                    format_date: (_date, time = true) => {
                        let date = new Date(_date);
                        // let date = new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(),  fecha.getUTCHours(), fecha.getUTCMinutes(), fecha.getUTCSeconds());
                        let day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate();
                        let month = date.getMonth() + 1;
                        month = month < 10 ? `0${month}` : month;
                        if (time) {
                            let hours = date.getHours();
                            let am = 'AM';
                            if (hours > 12) {
                                hours = hours - 12;
                                am = 'PM'
                            }
                            let minutes = date.getMinutes();
                            minutes = minutes < 10 ? `0${minutes}` : minutes;
                            return `${day}/${month}/${date.getFullYear()} ${hours}:${minutes} ${am}`;

                        }
                        return `${day}/${month}/${date.getFullYear()}`;

                    },
                },
            });

            // return res.json(dte_json);

            return res.send({ status: "success", data: html, dte: dte_json });
        } catch (err) {
            return res.json({ status: "error", message: "", err });
        }

    },

    getDTEJsonByCOde: async (req, res) => {
        try {
            const { uuid, fecha } = req.params;
            const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            console.log(fecha)
            if (regex.test(uuid)) {
                let dte = await DTE_Model.findOne({
                    where: {
                        codigo: uuid,
                        createdAt: {
                            [Op.gte]: new Date(`${fecha}T00:00:00Z`),
                        }
                    }
                });

                if (dte === null) {
                    return res.json({ status: "error", data: req.params, message: "Documento no encontrado" });
                }

                dte_json = dte.dte;
                dte_json.responseMH = dte.responseMH;

                return res.json({
                    status: "success",
                    json: dte_json,
                    model: dte.id,
                });


            }

            return res.json({ status: "error", data: req.params, message: "Codigo de Generacion no tiene el formato correcto" });
        } catch (err) {
            return res.json({ status: "error", message: "", err });
        }
    },

    posMode: async (req, res) => {
        let sellers = await Employee.findAll({ where: { isSeller: 1 } }).catch(e => next(e));
        let distritos = require('../../DTE/Catalogos/distritos.json').values;
        let municipios = require('../../DTE/Catalogos/CAT-013.json').items;
        let departamentos = require('../../DTE/Catalogos/CAT-012.json').items;
        let dptos = JSON.stringify(require('../../DTE/Catalogos/direction.json'));
        let dis = JSON.stringify(require('../../DTE/Catalogos/distritos_.json'));
        let giros = require('../../DTE/Catalogos/CAT-019.json').items;
        let sucursal = await Sucursal.findByPk(req.session.sucursal);


        // console.log(await tokenManager.getToken());
        return res.render('POS/pos', { pageTitle: 'Faturación y Cobro', sellers, distritos, municipios, departamentos, dptos, dis, giros, sucursal, helper_url });
    },

    getClientToSelect2: async (req, res) => {

        let searchLimit = req.query.limit ? parseInt(req.query.limit) : 10;
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
            let json = [];
            for (let index = 0; index < clients.length; index++) {
                let sale_details = null;
                let warnings = {};
                let sale = await Sale.findOne({
                    where: {
                        client: clients[index].id,
                        _status: { [Op.in]: ['process', 'closed', 'prepared'] },
                        invoice_type: { [Op.is]: null },
                    }
                })

                if (sale !== null) {

                    sale_details = await SaleDetail.findAll({
                        where: {
                            sale: sale.id,
                        },
                        attributes: [
                            'product',
                            'price',
                            'description',
                            'image',
                            'cant',
                            'reserved',
                            'ready',
                            'id',
                            'sale',
                        ]
                    });

                    let largo = sale_details.length;
                    for (let index = 0; index < largo; index++) {
                        if (sale_details[index].ready < sale_details[index].reserved) {
                            let stock = await Stock.findOne({
                                where: {
                                    product: sale_details[index].product,
                                    sucursal: sale.sucursal,
                                },
                                raw: true,
                            });

                            if (stock) {
                                if (stock.cant < 4) {
                                    warnings[sale_details[index].id] = "Ultimas unidades, se recomienda revisar antes de facturar la orden";
                                }

                            } else {
                                warnings[sale_details[index].id] = "Stock no encontrado, pida al desarrollador que revise";
                            }


                        }
                    }
                }

                json.push({
                    value: clients[index].id,
                    label: clients[index].name,
                    client: clients[index],
                    sale, sale_details,
                    warnings,
                });
            }

            return res.json(json);
        } catch (error) {
            console.log(error.message)
            return res.status(500).json({ 'error': 'Internal Server Error' });
        }
    },

    getClient: async (req, res) => {

        let client = req.query.client;
        client = await Client.findByPk(client);

        if (client === null) return res.status(404).json({ error: 'Cliente no encontrado' });
        let sale = await Sale.findOne({
            where: {
                client: client.id,
                _status: { [Op.in]: ['process', 'closed', 'prepared'] },
                invoice_type: { [Op.is]: null },
            }
        })

        if (sale !== null) {
            let sale_details = await SaleDetail.findAll({
                where: {
                    sale: sale.id,
                },
            });

            let warnings = {};

            //verificar que detalles deben manejarse como advertencias
            let largo = sale_details.length;
            for (let index = 0; index < largo; index++) {
                if (sale_details[index].ready < sale_details[index].reserved) {
                    let stock = await Stock.findOne({
                        where: {
                            product: sale_details[index].product,
                            sucursal: sale.sucursal,
                        },
                        raw: true,
                    });

                    if (stock) {
                        if (stock.cant < 4) {
                            warnings[sale_details[index].id] = "Ultimas unidades, se recomienda revisar antes de facturar la orden";
                        }

                    } else {
                        warnings[sale_details[index].id] = "Stock no encontrado, pida al desarrollador que revise";
                    }


                }
            }



            return res.json({ client, sale, sale_details, warnings });
        }
        return res.json({ client, sale: null, sale_details: null });


    },

    getOrder: async (req, res) => {
        let order = req.query.order;
        order = await Sale.findByPk(order);



        if (order === null) return res.status(404).json({ error: 'Orden no encontrada' });
        if (order.invoice_number !== null && order.invoice_number > 0) return res.status(404).json({ error: 'Orden ya facturada' });


        let order_details = await SaleDetail.findAll({
            where: {
                sale: order.id,
            },

        });

        let client = await Client.findByPk(order.client);

        let warnings = {};

        //verificar que detalles deben manejarse como advertencias
        let largo = order_details.length;
        for (let index = 0; index < largo; index++) {
            if (order_details[index].ready < order_details[index].reserved) {
                let stock = await Stock.findOne({
                    where: {
                        product: order_details[index].product,
                        sucursal: order.sucursal,
                    },
                });

                if (stock) {
                    if (stock.cant < 4) {
                        warnings[order_details[index].id] = "Ultimas unidades, se recomienda revisar antes de facturar la orden";
                    }

                } else {
                    warnings[order_details[index].id] = "Stock no encontrado, pida al desarrollador que revise";
                }


            }
        }


        return res.json({ status: "success", client, sale: order, sale_details: order_details, warnings });
    },

    ordersToBeBilled: async (req, res) => {

        let sales = await Sale.findAll({
            where: {
                _status: { [Op.in]: ['closed', 'prepared', 'delivered', 'transport'] },
                invoice_type: { [Op.is]: null },
                sucursal: req.session.sucursal,
            },
            order: [
                ['createdAt', 'DESC'],
            ],
            raw: true,
        });


        let tmp = await Client.findAll({
            where: {
                id: { [Op.in]: sales.map(sale => sale.client) },
            },
            raw: true,
        });

        let clients = {};
        tmp.forEach(element => { clients[element.id] = element; });
        tmp = await Employee.findAll({
            where: {
                id: { [Op.in]: sales.map(sale => sale.seller) },
            },
        });
        let sellers = {};
        tmp.forEach(element => { sellers[element.id] = element; });

        return res.json({ sales, clients, sellers, });


    },

    marcarGuia: async (req, res) => {
        let sale = await Sale.findByPk(req.body.order);
        if (sale) {
            sale.label = true;
            await sale.save();
            return res.json({ status: 'success', message: 'guia marcada' });
        }
        return res.json({ status: 'errorMessage', message: 'orden no encontrada' });
    },

    ordersGuides: async (req, res) => {

        let sales = await Sale.findAll({
            where: {
                _status: { [Op.in]: ['closed', 'prepared'] },
                label: false,
                sucursal: req.session.sucursal,
                delivery_type: 'delivery',
            },
            order: [
                ['createdAt', 'DESC'],
            ],
            raw: true,
        });


        let tmp = await Client.findAll({
            where: {
                id: { [Op.in]: sales.map(sale => sale.client) },
            },
            raw: true,
        });

        let clients = {};
        tmp.forEach(element => {

            if (element.departamento !== null) {
                element.direction = `${element.direction}${element.distrito !== null ? ", Distrito de " + element.distrito : ''}, ${municipios[element.departamento][element.municipio]} ${departamentos[element.departamento]}`;
            }
            clients[element.id] = element;
            //TOKEN
        });



        tmp = await Provider.findAll({
            where: {
                id: { [Op.in]: sales.map(sale => sale.delivery_provider) },
            },
            raw: true,
        });
        let providers = {};
        tmp.forEach(element => { providers[element.id] = element; });

        return res.json({ sales, clients, providers });

    },

    // post
    processOrder: async (req, res) => {
        let valor_iva = parseFloat(process.env.IVA);
        // obtener los datos de la solicitud
        let data = req.body;
        let client = data.client ? await Client.findByPk(data.client) : null;
        let sale = data.order_number ? await Sale.findByPk(data.order_number) : null;
        if (client && sale) {
            if (sale.invoice_number !== null && sale.invoice_number !== undefined) {
                return res.json({ status: 'errorMessage', message: 'Orden ya facturada' });
            }

            //Buscar la sucursal
            let sucursal = await Sucursal.findByPk(req.session.sucursal);
            //buscar la caja del vendedor
            let caja = req.session.petty_cash !== undefined && req.session.petty_cash !== null
                ? await PettyCash.findByPk(req.session.petty_cash)
                : await PettyCash.findOne({ where: { sucursal: sucursal.id }, order: [['id', 'ASC']] });

            if (sucursal == null || caja === null) {
                return res.json({ status: 'errorMessage', message: 'Sucursal o Caja no encontradas' });
            }

            //buscar los detalles de la orden
            let sale_details = await SaleDetail.findAll({
                where: {
                    sale: sale.id,
                },
            });

            let tmp = await Product.findAll({
                where: {
                    id: { [Op.in]: sale_details.map(detail => detail.product) },
                },
            });

            let products = {};
            tmp.forEach(prod => products[prod.id] = prod);

            if (sale_details.length === 0 || products.length === 0) {
                return res.json({ status: 'errorMessage', message: 'Orden no tiene detalles' });
            }

            var pagos = [];
            var pagos_por_registrar = [];
            var restante_venta = Helper.fix_number(sale.balance + sale.delivery_amount - sale.collected);

            //verificar si tiene pagos viejos relacionados
            var _efectivo = 0;
            var _tarjeta_debito = 0;
            var _tarjeta_credito = 0;
            var deposit = 0;
            var bitcoin = 0;
            var all_pays_amount = 0;

            //procesar los pagos actuales
            if (data.pos_details && data.pos_details.length > 0) {
                data.pos_details.forEach(pay => {

                    switch (pay.type) {
                        case "05": {
                            //el pago es mayor que el restante de la venta? 
                            let _r = restante_venta > pay.amount ? 0 : Helper.fix_number(pay.amount - restante_venta, 2);
                            let asigned_amount = (_r > 0 ? Helper.fix_number(pay.amount - _r) : pay.amount);

                            pagos_por_registrar.push({
                                client: client.id,
                                sales: [{
                                    "id": sale.id,
                                    "amount": asigned_amount
                                }],
                                type: 'transfer',
                                amount: pay.amount,
                                asigned_amount: asigned_amount,
                                bank: pay.bank,
                                reference: pay.reference,
                                createdBy: req.session.userSession.shortName,
                                fecha: pay.fecha ? pay.fecha : new Date()
                            });

                            deposit = Helper.fix_number(asigned_amount + deposit, 2);
                            restante_venta = Helper.fix_number(restante_venta - asigned_amount);
                            break;
                        }

                        case "02": {
                            // tarjeta de debito

                            let _r = restante_venta > pay.amount ? 0 : Helper.fix_number(pay.amount - restante_venta, 2);
                            let asigned_amount = (_r > 0 ? Helper.fix_number(pay.amount - _r) : pay.amount);


                            pagos_por_registrar.push({
                                client: client.id,
                                sales: [{
                                    "id": sale.id,
                                    "amount": asigned_amount
                                }],
                                type: 'credit_card',
                                amount: pay.amount,
                                asigned_amount: asigned_amount,
                                bank: pay.bank,
                                reference: pay.reference,
                                createdBy: req.session.userSession.shortName,
                                fecha: pay.fecha ? pay.fecha : new Date(),
                            });

                            _tarjeta_debito = Helper.fix_number(asigned_amount + _tarjeta_debito, 2);
                            restante_venta = Helper.fix_number(restante_venta - asigned_amount);
                            break;
                        }


                        case "03": {
                            // tarjeta credito
                            let _r = restante_venta > pay.amount ? 0 : Helper.fix_number(pay.amount - restante_venta, 2);
                            let asigned_amount = (_r > 0 ? Helper.fix_number(pay.amount - _r) : pay.amount);


                            pagos_por_registrar.push({
                                client: client.id,
                                sales: [{
                                    "id": sale.id,
                                    "amount": asigned_amount
                                }],
                                type: 'credit_card',
                                amount: pay.amount,
                                asigned_amount: asigned_amount,
                                bank: pay.bank,
                                reference: pay.reference,
                                createdBy: req.session.userSession.shortName,
                                fecha: pay.fecha ? pay.fecha : new Date(),
                            });


                            _tarjeta_credito = Helper.fix_number(asigned_amount + _tarjeta_credito, 2);
                            restante_venta = Helper.fix_number(restante_venta - asigned_amount);

                            break;
                        }

                        case "11": {
                            // bitcoin
                            let _r = restante_venta > pay.amount ? 0 : Helper.fix_number(pay.amount - restante_venta, 2);
                            let asigned_amount = (_r > 0 ? Helper.fix_number(pay.amount - _r) : pay.amount);

                            pagos_por_registrar.push({
                                client: client.id,
                                sales: [{
                                    "id": sale.id,
                                    "amount": asigned_amount
                                }],
                                type: 'bitcoin',
                                amount: pay.amount,
                                asigned_amount: asigned_amount,
                                bank: pay.bank,
                                reference: pay.reference,
                                createdBy: req.session.userSession.shortName,
                                fecha: pay.fecha ? pay.fecha : new Date(),
                            });
                            bitcoin = Helper.fix_number(asigned_amount + bitcoin, 2);
                            restante_venta = Helper.fix_number(restante_venta - asigned_amount);
                            break;
                        }
                    }

                    all_pays_amount = Helper.fix_number(all_pays_amount + pay.amount);


                });
            }
            //recorrer las formas de pago para formar el reporte de pagos
            if (data.cash > 0) {
                let _r = restante_venta > data.cash ? 0 : Helper.fix_number(data.cash - restante_venta, 2);
                let asigned_amount = (_r > 0 ? Helper.fix_number(data.cash - _r) : data.cash);
                _efectivo = Helper.fix_number(asigned_amount + _efectivo, 2);
                pagos_por_registrar.push({
                    client: client.id,
                    sales: [{
                        "id": sale.id,
                        "amount": asigned_amount
                    }],
                    type: 'money',
                    amount: data.cash,
                    asigned_amount: asigned_amount,
                    bank: null,
                    reference: null,
                    createdBy: req.session.userSession.shortName,
                    fecha: new Date()
                });

                restante_venta = Helper.fix_number(restante_venta - asigned_amount);
                all_pays_amount = Helper.fix_number(all_pays_amount + data.cash);

            }

            if (_efectivo > 0) {
                pagos.push({
                    codigo: "01",
                    montoPago: _efectivo,
                    referencia: null,
                    periodo: null,
                    plazo: null
                });
            }

            if (deposit > 0) {
                pagos.push({
                    codigo: "05",
                    montoPago: deposit,
                    referencia: null,
                    periodo: null,
                    plazo: null
                });
            }

            if (_tarjeta_debito > 0) {
                pagos.push({
                    codigo: "02",
                    montoPago: _tarjeta_debito,
                    referencia: null,
                    periodo: null,
                    plazo: null
                });
            }

            if (_tarjeta_credito > 0) {
                pagos.push({
                    codigo: "03",
                    montoPago: _tarjeta_credito,
                    referencia: null,
                    periodo: null,
                    plazo: null
                });
            }

            if (bitcoin > 0) {
                pagos.push({
                    codigo: "11",
                    montoPago: bitcoin,
                    referencia: null,
                    periodo: null,
                    plazo: null
                });
            }

            //Estructurar los datos del DTE Json
            const fechaActual = new Date();
            const diaFormateado = String(fechaActual.getDate()).padStart(2, '0');
            const mesFormateado = String(fechaActual.getMonth() + 1).padStart(2, '0');
            // Formatear la hora como HH:MM:SS (asegurándose de que tengan dos dígitos)
            const horasFormateadas = String(fechaActual.getHours()).padStart(2, '0');
            const minutosFormateados = String(fechaActual.getMinutes()).padStart(2, '0');
            const segundosFormateados = String(fechaActual.getSeconds()).padStart(2, '0');
            let dte_correlativo = await DTEController.generarNumeroControl(data.dte_type, sucursal.id, caja.id, sucursal.codEstableMH, caja.codPuntoVentaMH);
            let dte_json = {
                identificacion: {
                    version: null,
                    ambiente: process.env.DTE_AMBIENTE,
                    tipoDte: data.dte_type,
                    numeroControl: dte_correlativo.numControl,
                    codigoGeneracion: DTEController.generarCodigoGeneracion(),
                    tipoModelo: 1, //modelo de Factur5acion previo catalogo 3
                    tipoOperacion: 1, //modelo de trasmision normal catalogo 4
                    fecEmi: `${fechaActual.getFullYear()}-${mesFormateado}-${diaFormateado}`,
                    horEmi: `${horasFormateadas}:${minutosFormateados}:${segundosFormateados}`,
                    tipoMoneda: "USD",
                    tipoContingencia: null,
                    motivoContin: null
                },
                documentoRelacionado: null,
                emisor: sucursal.dte_emisor,
                receptor: null,
                otrosDocumentos: null,
                ventaTercero: null,
                cuerpoDocumento: null,
                resumen: null,
                extension: {
                    nombEntrega: req.session.userSession.shortName,
                    docuEntrega: null,
                    nombRecibe: null,
                    docuRecibe: null,
                    observaciones: null,
                    placaVehiculo: null,
                },
                apendice: null,
            };

            dte_json.emisor.codPuntoVentaMH = caja.codPuntoVentaMH;
            dte_json.emisor.codPuntoVenta = caja.codPuntoVenta;
            let contador = 0;

            var isValid = null;

            if (data.dte_type == '01') {
                //Aqui se va a procesar la estructura para la factura electronica
                dte_json.identificacion.version = 1;
                dte_json.receptor = client.for_fc_dte;

                data.calcular_retencion = data.calcular_retencion && !data.exento;

                let cuerpo = [];
                let sum_gravadas = 0, sum_exenta = 0, sum_iva = 0;
                sale_details.forEach(detail => {
                    contador++;
                    let product = products[detail.product];
                    let gravadas = 0.00, exenta = 0, iva = 0;
                    let price = detail.price;
                    if (data.exento) {
                        //en caso de que sea exento, se separa el IVA del precio al publico, pues este ya incluye IVA
                        price = Helper.fix_number(detail.price / (1 + valor_iva), 4);
                        exenta = Helper.fix_number((detail.cant * price), 4);
                        sum_exenta = Helper.fix_number(sum_exenta + exenta, 4);
                    } else {
                        gravadas = Helper.fix_number((detail.cant * detail.price), 4);
                        // iva == gravadas - (gravadas / 1.13)
                        // por si cambia el porcentaje de IVA se usa una variable de entorno para solo cambiar el porcentaje cuando se necesite
                        iva = Helper.fix_number((gravadas - (gravadas / (1 + valor_iva))), 4);
                        sum_gravadas = Helper.fix_number(sum_gravadas + gravadas, 4);
                        sum_iva = Helper.fix_number(sum_iva + iva, 4);
                    }
                    cuerpo.push({
                        numItem: contador,
                        tipoItem: 1, //bienes catalogo 11
                        numeroDocumento: null,
                        cantidad: detail.cant,
                        codigo: product.internal_code,
                        codTributo: null,
                        descripcion: product.name,
                        uniMedida: 59, //unidad catalogo 14
                        precioUni: price,
                        montoDescu: 0,
                        ventaNoSuj: 0,
                        ventaExenta: exenta,
                        ventaGravada: gravadas,
                        tributos: null,
                        psv: 0,
                        noGravado: 0.00,
                        ivaItem: iva
                    });

                });

                //verificar si la venta tiene envio y agregarlo al cuerpo del DTE
                if (sale.delivery_amount > 0) {
                    contador++;
                    let gravadas = 0.00, exenta = 0, iva = 0;
                    let price = sale.delivery_amount;
                    if (data.exento) {
                        //en caso de que sea exento, se separa el IVA del precio al publico, pues este ya incluye IVA
                        price = Helper.fix_number(sale.delivery_amount / (1 + valor_iva), 4);
                        exenta = Helper.fix_number(price, 4);
                        sum_exenta = Helper.fix_number(sum_exenta + exenta, 4);
                    } else {
                        gravadas = (price);
                        // iva == gravadas - (gravadas / 1.13)
                        // por si cambia el porcentaje de IVA se usa una variable de entorno para solo cambiar el porcentaje cuando se necesite
                        iva = Helper.fix_number(gravadas - (gravadas / (1 + valor_iva)), 4);

                        sum_gravadas = Helper.fix_number(sum_gravadas + gravadas, 4);
                        sum_iva = Helper.fix_number(sum_iva + iva, 4);
                    }
                    cuerpo.push({
                        numItem: contador,
                        tipoItem: 3, //bienes catalogo 11
                        numeroDocumento: null,
                        cantidad: 1,
                        codigo: '--ENVIO--',
                        codTributo: null,
                        descripcion: "Embalaje y envio",
                        uniMedida: 59, //unidad catalogo 14
                        precioUni: price,
                        montoDescu: 0,
                        ventaNoSuj: 0,
                        ventaExenta: exenta,
                        ventaGravada: gravadas,
                        tributos: null,
                        psv: 0,
                        noGravado: 0.00,
                        ivaItem: iva
                    });
                }

                dte_json.cuerpoDocumento = cuerpo;
                // console.log(sum_gravadas, sum_exenta, sum_iva);

                //si el cliente es agente de retencion, se calcula el 1%, porcentaje actual al valor de la venta sin IVA, si es que este supera los $100.00.
                // No aplica para personas exentas de IVA
                let retencion = data.calcular_retencion && (sum_gravadas - sum_iva) > 100 ? Helper.fix_number((sum_gravadas - sum_iva) * process.env.RETENTION) : 0;

                let total = sum_exenta > 0 ? sum_exenta : Helper.fix_number(sum_gravadas - retencion);

                dte_json.resumen = {
                    totalNoSuj: 0,
                    totalExenta: sum_exenta > 0 ? Helper.fix_number(sum_exenta) : 0,
                    totalGravada: sum_gravadas > 0 ? Helper.fix_number(sum_gravadas) : 0,
                    subTotalVentas: Helper.fix_number(sum_exenta + sum_gravadas),
                    descuNoSuj: 0,
                    descuExenta: 0,
                    descuGravada: 0,
                    porcentajeDescuento: 0,
                    totalDescu: 0,
                    tributos: null,
                    subTotal: Helper.fix_number(sum_exenta + sum_gravadas),
                    ivaRete1: retencion,
                    reteRenta: 0,
                    montoTotalOperacion: total,
                    totalNoGravado: 0,
                    totalPagar: total,
                    totalLetras: String(Money.money_to_string(total)).toLocaleUpperCase(),
                    totalIva: Helper.fix_number(sum_iva),
                    saldoFavor: 0,
                    condicionOperacion: 1,
                    pagos: restante_venta < 0.01 && pagos.length > 0 ? pagos : null,
                    numPagoElectronico: null
                }

                isValid = dteValidator.validateFC(dte_json);

            } else if (data.dte_type == '03') {
                //Aqui se va a procesar la el comprobante de credito fiscal
                dte_json.identificacion.version = 3;
                dte_json.receptor = client.for_ccf_dte;

                let cuerpo = [];
                let sum_gravadas = 0, sum_exenta = 0;

                sale_details.forEach(detail => {
                    contador++;
                    let product = products[detail.product];
                    let gravadas = 0, exenta = 0;
                    let price = Helper.fix_number(detail.price / (1 + valor_iva), 4);

                    gravadas = Helper.fix_number(detail.cant * price);
                    sum_gravadas = Helper.fix_number(sum_gravadas + gravadas, 4);

                    cuerpo.push({
                        numItem: contador,
                        tipoItem: 1, //bienes catalogo 11
                        numeroDocumento: null,
                        cantidad: detail.cant,
                        codigo: product.internal_code,
                        codTributo: null,
                        descripcion: product.name,
                        uniMedida: 59, //unidad catalogo 14
                        precioUni: price,
                        montoDescu: 0,
                        ventaNoSuj: 0,
                        ventaExenta: exenta,
                        ventaGravada: gravadas,
                        tributos: gravadas > 0 ? ["20",] : null,
                        psv: 0,
                        noGravado: 0.00,
                    });
                });

                //verificar si la venta tiene envio y agregarlo al cuerpo del DTE
                if (sale.delivery_amount > 0) {
                    contador++;
                    let gravadas = 0.00, exenta = 0, iva = 0;
                    price = Helper.fix_number(sale.delivery_amount / (1 + valor_iva), 4);

                    gravadas = (price);
                    sum_gravadas = Helper.fix_number(sum_gravadas + gravadas, 4);

                    cuerpo.push({
                        numItem: contador,
                        tipoItem: 3, //bienes y servicios  catalogo 11
                        numeroDocumento: null,
                        cantidad: 1,
                        codigo: '--ENVIO--',
                        codTributo: null,
                        descripcion: "Embalaje y envio",
                        uniMedida: 59, //unidad catalogo 14
                        precioUni: price,
                        montoDescu: 0,
                        ventaNoSuj: 0,
                        ventaExenta: exenta,
                        ventaGravada: gravadas,
                        tributos: gravadas > 0 ? ["20",] : null,
                        psv: 0,
                        noGravado: 0.00,
                    });
                }

                dte_json.cuerpoDocumento = cuerpo;

                //si el cliente es agente de retencion, se calcula el 1%, porcentaje actual al valor de la venta sin IVA, si es que este supera los $100.00.
                // No aplica para personas exentas de IVA
                //verificar si el cliente esta clasificado como gran contribuyente
                let retencion = client.classification == "gran" && sum_gravadas > 100 ? Helper.fix_number(sum_gravadas * process.env.RETENTION) : 0;
                let total = sum_exenta > 0 ? sum_exenta : Helper.fix_number((sum_gravadas * (1 + valor_iva)) - retencion);

                dte_json.resumen = {
                    totalNoSuj: 0,
                    totalExenta: 0,
                    totalGravada: sum_gravadas > 0 ? Helper.fix_number(sum_gravadas) : 0,
                    subTotalVentas: Helper.fix_number(sum_gravadas),
                    descuNoSuj: 0,
                    descuExenta: 0,
                    descuGravada: 0,
                    porcentajeDescuento: 0,
                    totalDescu: 0,
                    subTotal: Helper.fix_number(sum_gravadas),
                    ivaPerci1: 0,
                    ivaRete1: retencion,
                    reteRenta: 0,
                    montoTotalOperacion: total,
                    totalNoGravado: 0,
                    totalPagar: total,
                    totalLetras: String(Money.money_to_string(total)).toLocaleUpperCase(),
                    // totalIva: Helper.fix_number(sum_iva),
                    tributos: sum_gravadas > 0 ? [{
                        codigo: "20",
                        descripcion: "Impuesto al Valor Agregado 13%",
                        valor: Helper.fix_number(sum_gravadas * valor_iva)
                    }] : null,
                    saldoFavor: 0,
                    condicionOperacion: 1,
                    pagos: restante_venta < 0.01 && pagos.length > 0 ? pagos : null,
                    numPagoElectronico: null
                }

                isValid = dteValidator.validateCCF(dte_json);
            }

            if (!isValid.isValid) {
                return res.json({
                    status: 'errorMessage',
                    message: 'El DTE no cumple con la validacion minima',
                    errors: isValid.errors,
                    json: dte_json
                });
            }

            try {

                let enviado = await DTEController.transmitDTEWithRetry(dte_json);
                if (enviado.status === 'errorFirma') {
                    throw new Error("Error al firmar el DTE, verifique la configuracion de la firma electronica");
                } else if (enviado.status === 'errorToken') {
                    throw new Error(enviado.message);
                } else if (enviado.status === 'errorFatal') {
                    throw new Error(enviado.message);
                } else if (enviado.status === 'errorRejected') {
                    dte_json.responseMH = enviado.data;
                    throw new Error(enviado.message);
                } else {

                    let dteModel = {
                        sale: sale.id,
                        sucursal: sucursal.id,
                        caja: caja.id,
                        codigo: dte_json.identificacion.codigoGeneracion,
                        contingencia: null,
                        tipo: dte_json.identificacion.tipoDte,
                        trasnmitido: false,
                        entregado: false,
                        responseMH: null,
                        fecEmi: dte_json.identificacion.fecEmi,
                        client_label: dte_json.receptor.nombre,
                        correlativo: dte_correlativo.correlativo,
                        dte: null,
                        intentos: 1,
                        _errors: null
                    }

                    //enviar el DTE
                    if (enviado.status === 'errorContingencia') {
                        dte_json.identificacion.tipoContingencia = 1;
                        dte_json.identificacion.motivoContin = "Tiempo de espera del sistema de Hacienda y reintentos superados";
                        dte_json.identificacion.tipoModelo = 2;
                        dte_json.identificacion.tipoOperacion = 2;
                        dte_json.firmaElectronica = await DTEController.signDTE(dte_json)?.data;

                        dteModel.intentos = process.env.MH_API_MAX_RETRIES;

                    } else if (enviado.status === 'success') {
                        dteModel.trasnmitido = true;
                        dteModel.responseMH = enviado.data;
                        dte_json.selloRecibido = enviado.data?.selloRecibido || null;
                        dte_json.firmaElectronica = enviado.firma || null;
                    }

                    dteModel.dte = dte_json;

                    return await sequelize.transaction(async (t) => {
                        dteModel = await DTE_Model.create(dteModel, { transaction: t });

                        //registrar los pagos
                        let largo = pagos_por_registrar.length;
                        let pays_array = [];
                        let sum_pays = 0;
                        for (let index = 0; index < largo; index++) {
                            let pay = await SalePayment.create(pagos_por_registrar[index]);
                            pays_array.push({ id: pay.id, amount: pagos_por_registrar[index].asigned_amount });
                            sum_pays = Helper.fix_number(sum_pays + pagos_por_registrar[index].asigned_amount, 2);

                            if (pagos_por_registrar[index].type === 'money') {
                                //registrar el pago en la caja
                                let caja_movimiento = await PettyCashMoves.create({
                                    amount: pagos_por_registrar[index].amount,
                                    last_amount: caja.balance,
                                    concept: `Pago Recibido ${client.proccess_client ? "Clientes Varios" : client.name} DTE Codigo ${dte_json.identificacion.codigoGeneracion}`,
                                    petty_cash: caja.id,
                                    type: 'payment',
                                    isin: true,
                                    createdBy: req.session.userSession.shortName,
                                    asigned_to: client.proccess_client ? "Clientes Varios" : client.name,
                                    _number: 0
                                }, { transaction: t });

                                caja.balance = Helper.fix_number(caja.balance + pagos_por_registrar[index].amount, 2);
                                caja.save({ transaction: t });
                            }

                        }

                        //registrar saldo al cliente
                        client.balance = Helper.fix_number(client.balance + all_pays_amount, 2);
                        await client.save({ transaction: t });

                        //modificar la venta
                        sale.payments = sale.payments.concat(pays_array);
                        sale.invoice_type = "dte";
                        sale.collected = Helper.fix_number(sale.collected + sum_pays, 2);
                        sale.invoice_number = dteModel.id;
                        sale.invoice_date = new Date(`${dte_json.identificacion.fecEmi} ${dte_json.identificacion.horEmi}`);
                        if (sale._status == "process") {
                            sale._status = "closed";
                            sale.delivery_type = "local";
                        }
                        await sale.save({ transaction: t });

                        if (client.correo !== null && client.correo !== "") {
                            //enviar correo
                            axios.get(`${helper_url}/utils/services/sendPDF/${dteModel.id}?dummy_key=03b10bac1ef3b941?hl=es`).then(response => {
                                //  console.log(response) 
                            });
                        }

                        return res.json({
                            status: 'success',
                            json: dteModel,
                            message: 'Orden procesada correctamente, DTE enviado exitosamente',
                        });
                    });
                }
            } catch (error) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Orden o Cliente no encontrados' + error.message ? error.message : '',
                    error,
                    json: dte_json
                });
            }
        }
        return res.json({ status: 'errorMessage', message: 'Orden o Cliente no encontrados' });
    },

    relacionar_pagos: async (req, res) => {
        if (cache.get('relacionar_pagos')) {
            return res.json({ status: 'errorMessage', message: 'Proceso de relacionar pagos en curso, espere unos minutos' });
        }

        cache.put('relacionar_pagos', true); // establecer la bandera que diga que este proceso esta en curso por 5 minutos
        //buscar los pagos que tengan montos sin asignar
        let tmp = await sequelize.query(`SELECT * FROM crm_sale_payment WHERE asigned_amount < amount`, {
            type: sequelize.QueryTypes.SELECT,
            model: SalePayment
        });
        let pagos = {}
        tmp.forEach(pago => {
            if (pagos[pago.client] === undefined) {
                pagos[pago.client] = [];
            }
            pagos[pago.client].push(pago);
        });

        tmp = await await sequelize.query(`SELECT * FROM crm_sale WHERE client in (SELECT * FROM crm_sale_payment WHERE asigned_amount < amount) and collected < (balance + delivery_amount)`, {
            type: sequelize.QueryTypes.SELECT,
            model: Sale
        });

        let ventas = {};
        tmp.forEach(venta => {
            if (ventas[venta.client] === undefined) {
                ventas[venta.client] = [];
            }
            ventas[venta.client].push(venta);
        });


        let clientes = await Client.findAll({
            where: {
                id: { [Op.in]: Object.keys(pagos) }
            },
        });

        //recorrer los clientes
        for (let index = 0; index < clientes.length; index++) {
            const cliente = clientes[index];
            if (pagos[cliente.id] === undefined || ventas[cliente.id] === undefined) {
                continue;
            }
            //recorrer los pagos del cliente
            for (let j = 0; j < pagos[cliente.id].length; j++) {
                const pago = pagos[cliente.id][j];
                let monto_asignado = pago.asigned_amount;
                //recorrer las ventas del cliente
                for (let k = 0; k < ventas[cliente.id].length; k++) {
                    const venta = ventas[cliente.id][k];
                    if (monto_asignado <= 0) {
                        break;
                    }
                    //verificar si la venta tiene saldo pendiente
                    let saldo_pendiente = Helper.fix_number(venta.balance + venta.delivery_amount - venta.collected, 2);
                    if (saldo_pendiente <= 0) {
                        continue;
                    }
                    //asignar el monto al pago
                    let monto_a_asignar = Math.min(monto_asignado, saldo_pendiente);
                    await SalePayment.update({
                        asigned_amount: Helper.fix_number(pago.asigned_amount + monto_a_asignar, 2)
                    }, {
                        where: {
                            id: pago.id
                        }
                    });
                    await Sale.update({
                        collected: Helper.fix_number(venta.collected + monto_a_asignar, 2)
                    }, {
                        where: {
                            id: venta.id
                        }
                    });
                    monto_asignado = Helper.fix_number(monto_asignado - monto_a_asignar, 2);
                }
            }
        }

        cache.put('relacionar_pagos', true); // establecer la bandera que diga que este proceso esta en curso por 5 minutos


    },


    view_any_dte: async (req, res) => {
        let dte = await DTE_Model.findByPk(req.params.id);
        if (dte) {

            let sucursal = await Sucursal.findByPk(dte.sucursal);
            let tipos_documento = {
                '36': "NIT",
                '13': "DUI",
                '37': "Otro",
                '03': "Pasaporte",
                '02': "Carnet de Residente",
            }

            if (dte.tipo == "contingen") {
                return res.render('POS/dte/view_contingencia', {
                    pageTitle: dte.codigo,
                    dte_types,
                    dte,
                    sucursal,
                    helper_url,
                    tipos_contingencia: {
                        1: "No disponibilidad de sistema del MH",
                        2: "No disponibilidad de sistema del emisor",
                        3: "Falla en el suministro de servicio de Internet del Emisor",
                        4: "Falla en el suministro de servicio de energia eléctrica del emisor que impida la transmisión de los DTE",
                        5: "Otro",
                    }
                });

            } else if (dte.tipo == "anulacion") {
                return res.render('POS/dte/view_invalidacion', {
                    pageTitle: dte.codigo,
                    dte_types,
                    dte,
                    sucursal,
                    helper_url,
                    tipos_documento,
                    tipos_invalidacion: {
                        1: "Error en la Información del Documento Tributario Electrónico a invalidar.",
                        2: "Rescindir de la operación realizada.",
                        3: "Otro",
                    }
                });
            }
            return res.render('POS/dte/view', {
                pageTitle: dte.codigo,
                dte_types,
                dte,
                sucursal,
                helper_url,
                tipos_documento
            });
        }

        return res.json({
            status: "error",
            message: "DTE no Encontrado, verifique los datos",
        })
    },

    create_manual_fc: async (req, res) => {

        const sucursals = await Sucursal.findAll();
        const distritos = require('../../DTE/Catalogos/distritos.json').values;
        const municipios = require('../../DTE/Catalogos/CAT-013.json').items;
        const departamentos = require('../../DTE/Catalogos/CAT-012.json').items;
        const dptos = JSON.stringify(require('../../DTE/Catalogos/direction.json'));
        const dis = JSON.stringify(require('../../DTE/Catalogos/distritos_.json'));
        const giros = require('../../DTE/Catalogos/CAT-019.json').items;

        const _views = {
            '03': 'create_dte_ccf',
            '01': 'create_dte_fc',
            '05': 'create_dte_nc',
            '14': 'create_dte_fse',
            // '00': 'create_test_documents',
            'invalidation': 'invalidation_dte',
        }


        return res.render(`POS/dte/${_views[req.params.dte]}`, {
            pageTitle: "DTES Manuales",
            dte_types,
            sucursals,
            helper_url,
            distritos,
            municipios,
            departamentos,
            dptos,
            dis,
            giros,
            VALOR_IVA,
        });

    },

    process_manual_dte: async (req, res) => {
        let isValid = false;
        let data = req.body;
        let sucursal = await Sucursal.findByPk(req.session.sucursal);
        let caja = await PettyCash.findOne({ where: { sucursal: sucursal.id }, order: [['id', 'ASC']] });
        if (sucursal == null || caja === null) { return res.json({ status: 'errorMessage', message: 'Sucursal o Caja no encontradas' }); }
        //Estructurar los datos del DTE Json
        const fechaActual = new Date();
        const diaFormateado = String(fechaActual.getDate()).padStart(2, '0');
        const mesFormateado = String(fechaActual.getMonth() + 1).padStart(2, '0');
        // Formatear la hora como HH:MM:SS (asegurándose de que tengan dos dígitos)
        const horasFormateadas = String(fechaActual.getHours()).padStart(2, '0');
        const minutosFormateados = String(fechaActual.getMinutes()).padStart(2, '0');
        const segundosFormateados = String(fechaActual.getSeconds()).padStart(2, '0');

        let dte_correlativo = await DTEController.generarNumeroControl(data.dte_type, sucursal.id, caja.id, sucursal.codEstableMH, caja.codPuntoVentaMH);
        let dte_json = null;

        if (data.dte_type == '03' || data.dte_type == '01') {
            dte_json = {
                identificacion: {
                    version: data.dte_type == '03' ? 3 : 1,
                    ambiente: process.env.DTE_AMBIENTE,
                    tipoDte: data.dte_type,
                    numeroControl: dte_correlativo.numControl,
                    codigoGeneracion: DTEController.generarCodigoGeneracion(),
                    tipoModelo: 1, //modelo de Factur5acion previo catalogo 3
                    tipoOperacion: 1, //modelo de trasmision normal catalogo 4
                    fecEmi: `${fechaActual.getFullYear()}-${mesFormateado}-${diaFormateado}`,
                    horEmi: `${horasFormateadas}:${minutosFormateados}:${segundosFormateados}`,
                    tipoMoneda: "USD",
                    tipoContingencia: null,
                    motivoContin: null
                },
                documentoRelacionado: null,
                emisor: sucursal.dte_emisor,
                receptor: data.receptor,
                otrosDocumentos: null,
                ventaTercero: null,
                cuerpoDocumento: data.cuerpoDocumento,
                resumen: data.resumen,
                extension: {
                    nombEntrega: req.session.userSession.shortName,
                    docuEntrega: null,
                    nombRecibe: null,
                    docuRecibe: null,
                    observaciones: null,
                    placaVehiculo: null,
                },
                apendice: data.apendice,
            };

            dte_json.emisor.codPuntoVentaMH = caja.codPuntoVentaMH;
            dte_json.emisor.codPuntoVenta = caja.codPuntoVenta;

            isValid = data.dte_type == '03' ? dteValidator.validateCCF(dte_json) : dteValidator.validateFC(dte_json);

            if (!isValid.isValid) {
                return res.json({
                    status: 'errorMessage',
                    message: 'El DTE no cumple con la validacion minima',
                    errors: isValid.errors,
                    json: dte_json
                });
            }

            try {

                let enviado = await DTEController.transmitDTEWithRetry(dte_json);
                if (enviado.status === 'errorFirma') {
                    throw new Error("Error al firmar el DTE, verifique la configuracion de la firma electronica");
                } else if (enviado.status === 'errorToken') {
                    throw new Error(enviado.message);
                } else if (enviado.status === 'errorFatal') {
                    throw new Error(enviado.message);
                } else if (enviado.status === 'errorRejected') {
                    let failed = await FailedDte.create({
                        _request: req.body,
                        _user: req.session.userSession.shortName,
                        opt: "Creacion Manual",
                        responseMH: enviado.data,
                        dte: dte_json
                    });

                    dte_json.responseMH = enviado.data;
                    // console.log(enviado.data)
                    throw new Error(enviado.message);
                } else {


                    let dteModel = {
                        sale: null,
                        sucursal: sucursal.id,
                        caja: caja.id,
                        codigo: dte_json.identificacion.codigoGeneracion,
                        contingencia: null,
                        tipo: dte_json.identificacion.tipoDte,
                        trasnmitido: false,
                        entregado: false,
                        responseMH: null,
                        correlativo: dte_correlativo.correlativo,
                        dte: null,
                        intentos: 1,
                        _errors: null,
                        fecEmi: dte_json.identificacion.fecEmi,
                        client_label: dte_json.receptor.nombre,
                    }

                    //enviar el DTE
                    if (enviado.status === 'errorContingencia') {
                        dte_json.identificacion.tipoContingencia = 1;
                        dte_json.identificacion.motivoContin = "Tiempo de espera del sistema de Hacienda y reintentos superados";
                        dte_json.identificacion.tipoModelo = 2;
                        dte_json.identificacion.tipoOperacion = 2;
                        dte_json.firmaElectronica = await DTEController.signDTE(dte_json)?.data;

                        dteModel.intentos = process.env.MH_API_MAX_RETRIES;

                    } else if (enviado.status === 'success') {
                        dteModel.trasnmitido = true;
                        dteModel.responseMH = enviado.data;
                        dte_json.selloRecibido = enviado.data?.selloRecibido || null;
                        dte_json.firmaElectronica = enviado.firma || null;
                    }

                    dteModel.dte = dte_json;

                    return await sequelize.transaction(async (t) => {
                        dteModel = await DTE_Model.create(dteModel, { transaction: t });
                        if (dte_json.receptor.correo !== null && dte_json.receptor.correo !== "") {
                            //enviar correo
                            // axios.get(`${helper_url}/utils/services/sendPDF/${dteModel.id}?dummy_key=03b10bac1ef3b941?hl=es`).then(response => {  });
                        }

                        return res.json({
                            status: 'success',
                            json: dteModel,
                            message: 'Orden procesada correctamente, DTE enviado exitosamente',
                        });
                    });
                }
            } catch (error) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Error: ' + error.message ? error.message : '',
                    error,
                    json: dte_json
                });
            }


        } else if (data.dte_type == '05') {

            let registro = await DTE_Model.findByPk(data.model);
            if (!registro || (registro.tipo !== "03" && registro.tipo !== "01")) {
                return res.json({
                    status: 'errorMessage',
                    message: 'El DTE se ha encontrado o no es CCFE',
                    data: data
                });
            }

            dte_json = {
                identificacion: {
                    version: 3,
                    ambiente: process.env.DTE_AMBIENTE,
                    tipoDte: data.dte_type,
                    numeroControl: dte_correlativo.numControl,
                    codigoGeneracion: DTEController.generarCodigoGeneracion(),
                    tipoModelo: 1, //modelo de Factur5acion previo catalogo 3
                    tipoOperacion: 1, //modelo de trasmision normal catalogo 4
                    fecEmi: `${fechaActual.getFullYear()}-${mesFormateado}-${diaFormateado}`,
                    horEmi: `${horasFormateadas}:${minutosFormateados}:${segundosFormateados}`,
                    tipoMoneda: "USD",
                    tipoContingencia: null,
                    motivoContin: null
                },
                documentoRelacionado: [{
                    tipoDocumento: '03',
                    tipoGeneracion: 2,
                    numeroDocumento: registro.dte.identificacion.codigoGeneracion,
                    fechaEmision: registro.dte.identificacion.fecEmi,
                }],
                emisor: sucursal.for_nc_dte,
                receptor: registro.dte.receptor,
                ventaTercero: null,
                cuerpoDocumento: data.cuerpoDocumento,
                resumen: data.resumen,
                extension: {
                    nombEntrega: req.session.userSession.shortName,
                    docuEntrega: null,
                    nombRecibe: null,
                    docuRecibe: null,
                    observaciones: null,
                },
                apendice: data.apendice,
            };

            // dte_json.emisor.codPuntoVentaMH = caja.codPuntoVentaMH;
            // dte_json.emisor.codPuntoVenta = caja.codPuntoVenta;

            isValid = dteValidator.validateNC(dte_json);

            if (!isValid.isValid) {
                return res.json({
                    status: 'errorMessage',
                    message: 'El DTE no cumple con la validacion minima',
                    errors: isValid.errors,
                    json: dte_json
                });
            }

            try {

                let enviado = await DTEController.transmitDTEWithRetry(dte_json);
                if (enviado.status === 'errorFirma') {
                    throw new Error("Error al firmar el DTE, verifique la configuracion de la firma electronica");
                } else if (enviado.status === 'errorToken') {
                    throw new Error(enviado.message);
                } else if (enviado.status === 'errorFatal') {
                    throw new Error(enviado.message);
                } else if (enviado.status === 'errorRejected') {

                    let failed = await FailedDte.create({
                        _request: req.body,
                        _user: req.session.userSession.shortName,
                        opt: "Creacion Manual",
                        responseMH: enviado.data,
                        dte: dte_json
                    });

                    dte_json.responseMH = enviado.data;
                    throw new Error(enviado.message);
                } else {


                    let dteModel = {
                        sale: null,
                        sucursal: sucursal.id,
                        caja: caja.id,
                        codigo: dte_json.identificacion.codigoGeneracion,
                        contingencia: null,
                        tipo: dte_json.identificacion.tipoDte,
                        trasnmitido: false,
                        entregado: false,
                        responseMH: null,
                        correlativo: dte_correlativo.correlativo,
                        dte: null,
                        intentos: 1,
                        _errors: null,
                        fecEmi: dte_json.identificacion.fecEmi,
                        client_label: dte_json.receptor.nombre,
                    }

                    //enviar el DTE
                    if (enviado.status === 'errorContingencia') {
                        dte_json.identificacion.tipoContingencia = 1;
                        dte_json.identificacion.motivoContin = "Tiempo de espera del sistema de Hacienda y reintentos superados";
                        dte_json.identificacion.tipoModelo = 2;
                        dte_json.identificacion.tipoOperacion = 2;
                        dte_json.firmaElectronica = await DTEController.signDTE(dte_json)?.data;

                        dteModel.intentos = process.env.MH_API_MAX_RETRIES;

                    } else if (enviado.status === 'success') {
                        dteModel.trasnmitido = true;
                        dteModel.responseMH = enviado.data;
                        dte_json.selloRecibido = enviado.data?.selloRecibido || null;
                        dte_json.firmaElectronica = enviado.firma || null;
                    }

                    dteModel.dte = dte_json;

                    return await sequelize.transaction(async (t) => {
                        dteModel = await DTE_Model.create(dteModel, { transaction: t });
                        registro.nc = dteModel.id;
                        registro = await registro.save({ transaction: t });
                        if (dte_json.receptor.correo !== null && dte_json.receptor.correo !== "") {
                            //enviar correo
                            // axios.get(`${helper_url}/utils/services/sendPDF/${dteModel.id}?dummy_key=03b10bac1ef3b941?hl=es`).then(response => { });
                        }

                        return res.json({
                            status: 'success',
                            json: dteModel,
                            message: 'Orden procesada correctamente, DTE enviado exitosamente',
                        });
                    });
                }
            } catch (error) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Orden o Cliente no encontrados' + error.message ? error.message : '',
                    error,
                    json: dte_json
                });
            }

        } else if (data.dte_type == '14') {



            dte_json = {
                identificacion: {
                    version: 1,
                    ambiente: process.env.DTE_AMBIENTE,
                    tipoDte: data.dte_type,
                    numeroControl: dte_correlativo.numControl,
                    codigoGeneracion: DTEController.generarCodigoGeneracion(),
                    tipoModelo: 1, //modelo de Factur5acion previo catalogo 3
                    tipoOperacion: 1, //modelo de trasmision normal catalogo 4
                    fecEmi: `${fechaActual.getFullYear()}-${mesFormateado}-${diaFormateado}`,
                    horEmi: `${horasFormateadas}:${minutosFormateados}:${segundosFormateados}`,
                    tipoMoneda: "USD",
                    tipoContingencia: null,
                    motivoContin: null
                },
                emisor: sucursal.for_fse_dte,
                sujetoExcluido: data.sujetoExcluido,
                cuerpoDocumento: data.cuerpoDocumento,
                resumen: data.resumen,
                apendice: data.apendice,
            };

            dte_json.emisor.codPuntoVentaMH = caja.codPuntoVentaMH;
            dte_json.emisor.codPuntoVenta = caja.codPuntoVenta;

            isValid = dteValidator.validateFSE(dte_json);

            if (!isValid.isValid) {
                return res.json({
                    status: 'errorMessage',
                    message: 'El DTE no cumple con la validacion minima',
                    errors: isValid.errors,
                    json: dte_json
                });
            }

            try {

                let enviado = await DTEController.transmitDTEWithRetry(dte_json);
                if (enviado.status === 'errorFirma') {
                    throw new Error("Error al firmar el DTE, verifique la configuracion de la firma electronica");
                } else if (enviado.status === 'errorToken') {
                    throw new Error(enviado.message);
                } else if (enviado.status === 'errorFatal') {
                    throw new Error(enviado.message);
                } else if (enviado.status === 'errorRejected') {

                    let failed = await FailedDte.create({
                        _request: req.body,
                        _user: req.session.userSession.shortName,
                        opt: "Creacion Manual",
                        responseMH: enviado.data,
                        dte: dte_json
                    });

                    dte_json.responseMH = enviado.data;
                    console.log(enviado.data)
                    throw new Error(enviado.message);
                } else {


                    let dteModel = {
                        sale: null,
                        sucursal: sucursal.id,
                        caja: caja.id,
                        codigo: dte_json.identificacion.codigoGeneracion,
                        contingencia: null,
                        tipo: dte_json.identificacion.tipoDte,
                        trasnmitido: false,
                        entregado: false,
                        responseMH: null,
                        correlativo: dte_correlativo.correlativo,
                        dte: null,
                        intentos: 1,
                        _errors: null,
                        fecEmi: dte_json.identificacion.fecEmi,
                        client_label: dte_json.sujetoExcluido.nombre,
                    }

                    //enviar el DTE
                    if (enviado.status === 'errorContingencia') {
                        dte_json.identificacion.tipoContingencia = 1;
                        dte_json.identificacion.motivoContin = "Tiempo de espera del sistema de Hacienda y reintentos superados";
                        dte_json.identificacion.tipoModelo = 2;
                        dte_json.identificacion.tipoOperacion = 2;
                        dte_json.firmaElectronica = await DTEController.signDTE(dte_json)?.data;

                        dteModel.intentos = process.env.MH_API_MAX_RETRIES;

                    } else if (enviado.status === 'success') {
                        dteModel.trasnmitido = true;
                        dteModel.responseMH = enviado.data;
                        dte_json.selloRecibido = enviado.data?.selloRecibido || null;
                        dte_json.firmaElectronica = enviado.firma || null;
                    }

                    dteModel.dte = dte_json;

                    return await sequelize.transaction(async (t) => {
                        dteModel = await DTE_Model.create(dteModel, { transaction: t });
                        if (dte_json.sujetoExcluido.correo !== null && dte_json.sujetoExcluido.correo !== "") {
                            //enviar correo
                            axios.get(`${helper_url}/utils/services/sendPDF/${dteModel.id}?dummy_key=03b10bac1ef3b941?hl=es`)
                                .then(response => { });
                        }

                        return res.json({
                            status: 'success',
                            json: dteModel,
                            message: 'Orden procesada correctamente, DTE enviado exitosamente',
                        });
                    });
                }
            } catch (error) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Error: ' + error.message ? error.message : '',
                    error,
                    json: dte_json
                });
            }
        }
    },

    data_generar_pruebas: async (req, res) => {
        let data = req.body;
        let clients = [];
        let products = [];
        let tmp = await Product.findAll({
            where: {
                base_price: {
                    [Op.gt]: 0
                },
                id: {
                    [Op.gt]: 9000
                }
            },
            limit: 100,
        });

        tmp.forEach(prod => {
            products.push({
                codigo: prod.sku,
                descripcion: prod.name,
                precioUni: prod.base_price
            });
        })

        if (data.type == '01') {
            tmp = await Client.findAll({
                where: {
                    NIT_DUI: { [Op.not]: null },
                    id: { [Op.gt]: 2500 }
                },
                limit: 30
            });

            tmp.forEach(cl => {
                clients.push(cl.for_fc_dte);
            });
        } else if (data.type == '03') {

            tmp = await Client.findAll({
                where: {

                    id: {
                        [Op.in]: [
                            3564, 3890, 3304, 4257, 2227, 4929, 989, 2165
                        ]
                    }
                },
                limit: 30
            });

            tmp.forEach(cl => {
                clients.push(cl.for_ccf_dte);
            });

        }

        return res.json({
            status: 'success', clients, products, type: data.type
        });
    },


    invalidation_dte: async (req, res) => {
        let isValid = false;
        let data = req.body;
        let sucursal = await Sucursal.findByPk(req.session.sucursal);
        let caja = await PettyCash.findOne({ where: { sucursal: sucursal.id }, order: [['id', 'ASC']] });
        if (sucursal == null || caja === null) { return res.json({ status: 'errorMessage', message: 'Sucursal o Caja no encontradas' }); }

        //Estructurar los datos del DTE Json
        const fechaActual = new Date();
        const diaFormateado = String(fechaActual.getDate()).padStart(2, '0');
        const mesFormateado = String(fechaActual.getMonth() + 1).padStart(2, '0');
        // Formatear la hora como HH:MM:SS (asegurándose de que tengan dos dígitos)
        const horasFormateadas = String(fechaActual.getHours()).padStart(2, '0');
        const minutosFormateados = String(fechaActual.getMinutes()).padStart(2, '0');
        const segundosFormateados = String(fechaActual.getSeconds()).padStart(2, '0');

        let dte_anulado = await DTE_Model.findByPk(data.dte_anular);

        if (!dte_anulado || dte_anulado.invalidacion !== null || dte_anulado.nc !== null) {
            return res.json({
                status: 'errorMessage',
                message: 'Este DTE ya ha sido Anulado o tiene documentos relacionados',
            });
        }

        let montoIva = null;
        let receptor_tipoDocumento = "13";
        let receptor_numDocumento = null;

        if (dte_anulado.tipo == "01") {
            montoIva = dte_anulado.dte.resumen.totalIva;
            receptor_tipoDocumento = dte_anulado.dte.receptor.tipoDocumento;
            receptor_numDocumento = dte_anulado.dte.receptor.numDocumento;

        } else if (dte_anulado.tipo == "03" || dte_anulado.tipo == "05") {
            receptor_tipoDocumento = '36';
            receptor_numDocumento = dte_anulado.dte.receptor.nit;

            // [{"codigo":"20","descripcion":"Impuesto al Valor Agregado 13%","valor":62.4}]
            if (dte_anulado.dte.resumen.tributos[0].codigo == "20") {

                montoIva = dte_anulado.dte.resumen.tributos[0].valor;
            }
            //si no es el primer tributo el IVA, entonces buscarlo hasta encontralo
        } else if (dte_anulado.tipo == "14") {
            receptor_tipoDocumento = dte_anulado.dte.sujetoExcluido.tipoDocumento;
            receptor_numDocumento = dte_anulado.dte.sujetoExcluido.numDocumento;

        }



        let dte_json = {
            identificacion: {
                version: 2,
                ambiente: "00",
                codigoGeneracion: DTEController.generarCodigoGeneracion(),
                fecAnula: `${fechaActual.getFullYear()}-${mesFormateado}-${diaFormateado}`,
                horAnula: `${horasFormateadas}:${minutosFormateados}:${segundosFormateados}`,
            },
            emisor: sucursal.for_anulation_event,
            documento: {
                tipoDte: dte_anulado.dte.identificacion.tipoDte,
                codigoGeneracion: dte_anulado.codigo,
                selloRecibido: dte_anulado.responseMH.selloRecibido,
                numeroControl: dte_anulado.dte.identificacion.numeroControl,
                fecEmi: dte_anulado.dte.identificacion.fecEmi,
                montoIva: montoIva,
                codigoGeneracionR: null,
                tipoDocumento: receptor_tipoDocumento,
                numDocumento: receptor_numDocumento,
                nombre: dte_anulado.tipo == "14" ? dte_anulado.dte.sujetoExcluido.nombre : dte_anulado.dte.receptor.nombre,
                telefono: dte_anulado.tipo == "14" ? dte_anulado.dte.sujetoExcluido.telefono : dte_anulado.dte.receptor.telefono,
                correo: dte_anulado.tipo == "14" ? dte_anulado.dte.sujetoExcluido.correo : dte_anulado.dte.receptor.correo,
            },
            motivo: {
                tipoAnulacion: data.tipoAnulacion,
                motivoAnulacion: data.tipoAnulacion == 3 ? data.motivoAnulacion : null,
                nombreResponsable: data.nombreResponsable.trim(),
                tipDocResponsable: data.tipDocResponsable,
                numDocResponsable: data.numDocResponsable.trim(),
                nombreSolicita: data.nombreSolicita.trim(),
                tipDocSolicita: data.tipDocSolicita,
                numDocSolicita: data.numDocSolicita.trim(),
            }
        };

        dte_json.emisor.codPuntoVentaMH = caja.codPuntoVentaMH;
        dte_json.emisor.codPuntoVenta = caja.codPuntoVenta;

        let _r_ = /^[0-9+;]{8,50}$/i;
        if (!_r_.test(dte_json.documento.telefono = null)) {
            dte_json.documento.telefono = null;
        }

        isValid = dteValidator.validateAnulacion(dte_json);

        if (!isValid.isValid) {
            return res.json({
                status: 'errorMessage',
                message: 'El DTE no cumple con la validacion minima',
                errors: isValid.errors,
                json: dte_json
            });
        }




        try {

            let enviado = await DTEController.transmitirInvalidacion(dte_json);

            console.log(enviado.data);

            if (enviado.status === 'errorFirma') {
                throw new Error("Error al firmar el DTE, verifique la configuracion de la firma electronica");
            } else if (enviado.status === 'errorToken') {
                throw new Error(enviado.message);
            } else if (enviado.status === 'errorFatal') {
                throw new Error(enviado.message);
            } else if (enviado.status === 'errorRejected') {
                return res.json({
                    status: 'errorMessage',
                    message: 'La Solicitud fue rechazada por MH',
                    responseMH: enviado.data,
                    json: dte_json
                });
            } else if (enviado.status === 'success') {


                dte_json.selloRecibido = enviado.data?.selloRecibido || null;
                dte_json.firmaElectronica = enviado.firma || null;

                let dteModel = {
                    sale: null,
                    sucursal: sucursal.id,
                    caja: caja.id,
                    codigo: dte_json.identificacion.codigoGeneracion,
                    contingencia: null,
                    tipo: 'anulacion',
                    trasnmitido: true,
                    entregado: false,
                    responseMH: enviado.data,
                    correlativo: null,
                    dte: dte_json,
                    intentos: 1,
                    _errors: null,
                    fecEmi: dte_json.identificacion.fecAnula,
                    client_label: null,
                }




                return await sequelize.transaction(async (t) => {
                    dteModel = await DTE_Model.create(dteModel, { transaction: t });


                    dte_anulado.invalidacion = dteModel.id;
                    await dte_anulado.save({ transaction: t });

                    return res.json({
                        status: 'success',
                        json: dteModel,
                        message: 'Orden procesada correctamente, DTE enviado exitosamente',
                    });
                });
            }
        } catch (error) {
            return res.json({
                status: 'errorMessage',
                message: 'Error: ' + error.message ? error.message : '',
                error,
                json: dte_json
            });


        }



    },

    simular_contingencia: async (req, res) => {
        let isValid = false;
        let data = req.body;
        let sucursal = await Sucursal.findByPk(req.session.sucursal);
        let caja = await PettyCash.findOne({ where: { sucursal: sucursal.id }, order: [['id', 'ASC']] });
        if (sucursal == null || caja === null) { return res.json({ status: 'errorMessage', message: 'Sucursal o Caja no encontradas' }); }
        //Estructurar los datos del DTE Json
        const fechaActual = new Date();
        const diaFormateado = String(fechaActual.getDate()).padStart(2, '0');
        const mesFormateado = String(fechaActual.getMonth() + 1).padStart(2, '0');
        // Formatear la hora como HH:MM:SS (asegurándose de que tengan dos dígitos)
        const horasFormateadas = String(fechaActual.getHours()).padStart(2, '0');
        const minutosFormateados = String(fechaActual.getMinutes()).padStart(2, '0');
        const segundosFormateados = String(fechaActual.getSeconds()).padStart(2, '0');

        let dte_correlativo = await DTEController.generarNumeroControl(data.dte_type, sucursal.id, caja.id, sucursal.codEstableMH, caja.codPuntoVentaMH);
        let dte_json = null;

        if (data.dte_type == '03' || data.dte_type == '01') {
            dte_json = {
                identificacion: {
                    version: data.dte_type == '03' ? 3 : 1,
                    ambiente: process.env.DTE_AMBIENTE,
                    tipoDte: data.dte_type,
                    numeroControl: dte_correlativo.numControl,
                    codigoGeneracion: DTEController.generarCodigoGeneracion(),
                    tipoModelo: 2, //modelo de Factur5acion previo catalogo 3
                    tipoOperacion: 2, //modelo de trasmision normal catalogo 4
                    fecEmi: `${fechaActual.getFullYear()}-${mesFormateado}-${diaFormateado}`,
                    horEmi: `${horasFormateadas}:${minutosFormateados}:${segundosFormateados}`,
                    tipoMoneda: "USD",
                    tipoContingencia: 2,
                    motivoContin: null
                },
                documentoRelacionado: null,
                emisor: sucursal.dte_emisor,
                receptor: data.receptor,
                otrosDocumentos: null,
                ventaTercero: null,
                cuerpoDocumento: data.cuerpoDocumento,
                resumen: data.resumen,
                extension: {
                    nombEntrega: req.session.userSession.shortName,
                    docuEntrega: null,
                    nombRecibe: null,
                    docuRecibe: null,
                    observaciones: null,
                    placaVehiculo: null,
                },
                apendice: data.apendice,
            };

            dte_json.emisor.codPuntoVentaMH = caja.codPuntoVentaMH;
            dte_json.emisor.codPuntoVenta = caja.codPuntoVenta;

            isValid = data.dte_type == '03' ? dteValidator.validateCCF(dte_json) : dteValidator.validateFC(dte_json);

            if (!isValid.isValid) {
                return res.json({
                    status: 'errorMessage',
                    message: 'El DTE no cumple con la validacion minima',
                    errors: isValid.errors,
                    json: dte_json
                });
            }

            try {

                let dteModel = {
                    sale: null,
                    sucursal: sucursal.id,
                    caja: caja.id,
                    codigo: dte_json.identificacion.codigoGeneracion,
                    contingencia: null,
                    tipo: dte_json.identificacion.tipoDte,
                    trasnmitido: false,
                    entregado: false,
                    responseMH: null,
                    correlativo: dte_correlativo.correlativo,
                    dte: null,
                    intentos: 1,
                    _errors: null,
                    fecEmi: dte_json.identificacion.fecEmi,
                    client_label: dte_json.receptor.nombre,
                }


                dte_json.firmaElectronica = await DTEController.signDTE(dte_json)?.data;

                dteModel.intentos = process.env.MH_API_MAX_RETRIES;

                dteModel.dte = dte_json;

                return await sequelize.transaction(async (t) => {
                    dteModel = await DTE_Model.create(dteModel, { transaction: t });
                    if (dte_json.receptor.correo !== null && dte_json.receptor.correo !== "") {
                        //enviar correo
                        // axios.get(`${helper_url}/utils/services/sendPDF/${dteModel.id}?dummy_key=03b10bac1ef3b941?hl=es`).then(response => {  });
                    }

                    return res.json({
                        status: 'success',
                        json: dteModel,
                        message: 'Orden procesada correctamente, DTE enviado exitosamente',
                    });
                });


            } catch (error) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Error: ' + error.message ? error.message : '',
                    error,
                    json: dte_json
                });
            }


        }
    },

    contingencia_event: async (req, res) => {
        let DTES = await DTE_Model.findAll({
            where: {
                trasnmitido: 0
            }
        });

        if (DTES.length > 0) {

            let detalleDTE = [];
            let contador = 1;
            DTES.forEach(_d => {
                detalleDTE.push({
                    noItem: contador,
                    codigoGeneracion: _d.codigo,
                    tipoDoc: _d.tipo
                });

                contador++;
            })

            let sucursal = await Sucursal.findByPk(1);
            let caja = await PettyCash.findOne({ where: { sucursal: sucursal.id }, order: [['id', 'ASC']] });
            if (sucursal == null || caja === null) { return res.json({ status: 'errorMessage', message: 'Sucursal o Caja no encontradas' }); }
            //Estructurar los datos del DTE Json
            const fechaActual = new Date();
            const diaFormateado = String(fechaActual.getDate()).padStart(2, '0');
            const mesFormateado = String(fechaActual.getMonth() + 1).padStart(2, '0');
            // Formatear la hora como HH:MM:SS (asegurándose de que tengan dos dígitos)
            const horasFormateadas = String(fechaActual.getHours()).padStart(2, '0');
            const minutosFormateados = String(fechaActual.getMinutes()).padStart(2, '0');
            const segundosFormateados = String(fechaActual.getSeconds()).padStart(2, '0');


            let dte_contingencia = {
                identificacion: {
                    version: 3,
                    ambiente: process.env.DTE_AMBIENTE,
                    codigoGeneracion: DTEController.generarCodigoGeneracion(),
                    fTransmision: `${fechaActual.getFullYear()}-${mesFormateado}-${diaFormateado}`,
                    hTransmision: `${horasFormateadas}:${minutosFormateados}:${segundosFormateados}`,
                },
                emisor: sucursal.for_contingencia_event,
                detalleDTE: detalleDTE,
                motivo: {
                    fInicio: "2025-07-01",
                    fFin: "2025-07-01",
                    hInicio: '02:51:01',
                    hFin: '02:53:00',
                    tipoContingencia: 2,
                    motivoContingencia: null
                }
            }

            isValid = dteValidator.validateContingencia(dte_contingencia);

            if (!isValid.isValid) {
                return res.json({
                    status: 'errorMessage',
                    message: 'El DTE no cumple con la validacion minima',
                    errors: isValid.errors,
                    json: dte_contingencia
                });
            }

            const enviado = await DTEController.transmitirContingencia(dte_contingencia);
            if (enviado.status == "success") {

                dte_contingencia.selloRecibido = enviado.data?.selloRecibido || null;
                dte_contingencia.firmaElectronica = enviado.firma || null;

                let dteModel = {
                    sale: null,
                    sucursal: sucursal.id,
                    caja: caja.id,
                    codigo: dte_contingencia.identificacion.codigoGeneracion,
                    contingencia: null,
                    tipo: 'contingen',
                    trasnmitido: true,
                    entregado: false,
                    responseMH: enviado.data,
                    correlativo: null,
                    dte: dte_contingencia,
                    intentos: 1,
                    _errors: null,
                    fecEmi: dte_contingencia.identificacion.fTransmision,
                    client_label: null,
                }


                let _r = {
                    contingencia_response: enviado.data,
                    dtes: [],
                    status: 'success',
                }





                return await sequelize.transaction(async (t) => {
                    dteModel = await DTE_Model.create(dteModel, { transaction: t });
                    let largo = DTES.length;

                    for (let index = 0; index < largo; index++) {
                        let resultado = await DTEController.transmitDTEWithRetry(DTES[index].dte);

                        if (resultado.status === 'errorRejected') {
                            let failed = await FailedDte.create({
                                _request: DTES[index].dte,
                                _user: req.session.userSession.shortName,
                                opt: "Tansmision Contingencia",
                                responseMH: resultado.data,
                                dte: DTES[index].dte
                            });
                        }

                        DTES[index].responseMH = resultado.data;
                        DTES[index].contingencia = dteModel.id;
                        DTES[index].trasnmitido = true;
                        await DTES[index].save({ transaction: t });
                        _r.dtes.push(resultado.data);

                    }
                    // dte_anulado.invalidacion = dteModel.id;
                    // await dte_anulado.save({ transaction: t });

                    return res.json(_r);
                });

            }


        }
    },


    // aaaaaaaaaaaa: async (req, res) => {

    //     let firma = "eyJhbGciOiJSUzUxMiJ9.ewogICJpZGVudGlmaWNhY2lvbiIgOiB7CiAgICAidmVyc2lvbiIgOiAxLAogICAgImFtYmllbnRlIiA6ICIwMSIsCiAgICAidGlwb0R0ZSIgOiAiMDEiLAogICAgIm51bWVyb0NvbnRyb2wiIDogIkRURS0wMS1TMDA0UDAwMS0wMDAwMDAwMDAwMDAwNDQiLAogICAgImNvZGlnb0dlbmVyYWNpb24iIDogIkU5RkM5MTg2LUQ4QzItNDBGNi05QkRCLTZCNDAyRjk2Rjc1OSIsCiAgICAidGlwb01vZGVsbyIgOiAxLAogICAgInRpcG9PcGVyYWNpb24iIDogMSwKICAgICJmZWNFbWkiIDogIjIwMjUtMDctMDMiLAogICAgImhvckVtaSIgOiAiMDk6NTk6NDIiLAogICAgInRpcG9Nb25lZGEiIDogIlVTRCIsCiAgICAidGlwb0NvbnRpbmdlbmNpYSIgOiBudWxsLAogICAgIm1vdGl2b0NvbnRpbiIgOiBudWxsCiAgfSwKICAiZG9jdW1lbnRvUmVsYWNpb25hZG8iIDogbnVsbCwKICAiZW1pc29yIiA6IHsKICAgICJuaXQiIDogIjA2MTQwMzMxOCIsCiAgICAibnJjIiA6ICIzMzU5ODUyIiwKICAgICJub21icmUiIDogIkdlcmFyZG8gQWxmb25zbyBSaXZlcmEgQ29ydGV6IiwKICAgICJjb2RBY3RpdmlkYWQiIDogIjEwMDA2IiwKICAgICJkZXNjQWN0aXZpZGFkIiA6ICJDb21lcmNpYW50ZSIsCiAgICAibm9tYnJlQ29tZXJjaWFsIiA6ICJSaXZlcmFzIEdyb3VwIiwKICAgICJ0aXBvRXN0YWJsZWNpbWllbnRvIiA6ICIwMSIsCiAgICAiZGlyZWNjaW9uIiA6IHsKICAgICAgImRlcGFydGFtZW50byIgOiAiMDIiLAogICAgICAibXVuaWNpcGlvIiA6ICIxNSIsCiAgICAgICJjb21wbGVtZW50byIgOiAiM0EsIENhbGxlIE9yaWVudGUgeSAxQS4gQVYgU3VyIEVzcXVpbmEsIExvY2FsIDEiCiAgICB9LAogICAgInRlbGVmb25vIiA6ICIyNTI3ODY4MyIsCiAgICAiY29ycmVvIiA6ICJmYWN0dXJhY2lvbkByaXZlcmFzZ3JvdXAuY29tIiwKICAgICJjb2RFc3RhYmxlTUgiIDogIlMwMDQiLAogICAgImNvZEVzdGFibGUiIDogIlMwMDQiLAogICAgImNvZFB1bnRvVmVudGFNSCIgOiAiUDAwMSIsCiAgICAiY29kUHVudG9WZW50YSIgOiAiUDAwMSIKICB9LAogICJyZWNlcHRvciIgOiB7CiAgICAidGlwb0RvY3VtZW50byIgOiAiMTMiLAogICAgIm51bURvY3VtZW50byIgOiAiMDQyMTk0MjAtMSIsCiAgICAibnJjIiA6IG51bGwsCiAgICAibm9tYnJlIiA6ICJTYW5keSBZb21hcmEgVXRvIGRlIFBpbiIsCiAgICAiY29kQWN0aXZpZGFkIiA6IG51bGwsCiAgICAiZGVzY0FjdGl2aWRhZCIgOiBudWxsLAogICAgImRpcmVjY2lvbiIgOiB7CiAgICAgICJkZXBhcnRhbWVudG8iIDogIjAyIiwKICAgICAgIm11bmljaXBpbyIgOiAiMTUiLAogICAgICAiY29tcGxlbWVudG8iIDogIlJpdmVyYXMgR3JvdXAgU2FudGEgQW5hIgogICAgfSwKICAgICJ0ZWxlZm9ubyIgOiAiNzg1ODczNDkiLAogICAgImNvcnJlbyIgOiAic2FuZHl5b21pamltZW5lemRlcGluQGdtYWlsLmNvbSIKICB9LAogICJvdHJvc0RvY3VtZW50b3MiIDogbnVsbCwKICAidmVudGFUZXJjZXJvIiA6IG51bGwsCiAgImN1ZXJwb0RvY3VtZW50byIgOiBbIHsKICAgICJudW1JdGVtIiA6IDEsCiAgICAidGlwb0l0ZW0iIDogMSwKICAgICJudW1lcm9Eb2N1bWVudG8iIDogbnVsbCwKICAgICJjYW50aWRhZCIgOiAxLAogICAgImNvZGlnbyIgOiAiU1RSLTYxMDEzIiwKICAgICJjb2RUcmlidXRvIiA6IG51bGwsCiAgICAiZGVzY3JpcGNpb24iIDogIkVzdHVjaGUgcGFyYSBMYXB0b3AgTmVncm8iLAogICAgInVuaU1lZGlkYSIgOiA1OSwKICAgICJwcmVjaW9VbmkiIDogNywKICAgICJtb250b0Rlc2N1IiA6IDAsCiAgICAidmVudGFOb1N1aiIgOiAwLAogICAgInZlbnRhRXhlbnRhIiA6IDAsCiAgICAidmVudGFHcmF2YWRhIiA6IDcsCiAgICAidHJpYnV0b3MiIDogbnVsbCwKICAgICJwc3YiIDogMCwKICAgICJub0dyYXZhZG8iIDogMCwKICAgICJpdmFJdGVtIiA6IDAuODA1MwogIH0sIHsKICAgICJudW1JdGVtIiA6IDIsCiAgICAidGlwb0l0ZW0iIDogMSwKICAgICJudW1lcm9Eb2N1bWVudG8iIDogbnVsbCwKICAgICJjYW50aWRhZCIgOiAxLAogICAgImNvZGlnbyIgOiAiUy0zNzM3MSIsCiAgICAiY29kVHJpYnV0byIgOiBudWxsLAogICAgImRlc2NyaXBjaW9uIiA6ICJNaW5pIEJpbGxldGVyYSBJbnNwaXJhY2nDs24gVm9ndWUgQ2Fmw6kgQ2xhcm8iLAogICAgInVuaU1lZGlkYSIgOiA1OSwKICAgICJwcmVjaW9VbmkiIDogMy45NSwKICAgICJtb250b0Rlc2N1IiA6IDAsCiAgICAidmVudGFOb1N1aiIgOiAwLAogICAgInZlbnRhRXhlbnRhIiA6IDAsCiAgICAidmVudGFHcmF2YWRhIiA6IDMuOTUsCiAgICAidHJpYnV0b3MiIDogbnVsbCwKICAgICJwc3YiIDogMCwKICAgICJub0dyYXZhZG8iIDogMCwKICAgICJpdmFJdGVtIiA6IDAuNDU0NAogIH0sIHsKICAgICJudW1JdGVtIiA6IDMsCiAgICAidGlwb0l0ZW0iIDogMSwKICAgICJudW1lcm9Eb2N1bWVudG8iIDogbnVsbCwKICAgICJjYW50aWRhZCIgOiAxLAogICAgImNvZGlnbyIgOiAiODgzMzUxIiwKICAgICJjb2RUcmlidXRvIiA6IG51bGwsCiAgICAiZGVzY3JpcGNpb24iIDogIlRpamVyYSBkZSBQb2RhciBOZWdybyIsCiAgICAidW5pTWVkaWRhIiA6IDU5LAogICAgInByZWNpb1VuaSIgOiAyLjUsCiAgICAibW9udG9EZXNjdSIgOiAwLAogICAgInZlbnRhTm9TdWoiIDogMCwKICAgICJ2ZW50YUV4ZW50YSIgOiAwLAogICAgInZlbnRhR3JhdmFkYSIgOiAyLjUsCiAgICAidHJpYnV0b3MiIDogbnVsbCwKICAgICJwc3YiIDogMCwKICAgICJub0dyYXZhZG8iIDogMCwKICAgICJpdmFJdGVtIiA6IDAuMjg3NgogIH0sIHsKICAgICJudW1JdGVtIiA6IDQsCiAgICAidGlwb0l0ZW0iIDogMSwKICAgICJudW1lcm9Eb2N1bWVudG8iIDogbnVsbCwKICAgICJjYW50aWRhZCIgOiAxLAogICAgImNvZGlnbyIgOiAiTEhDLUZSMDQ0IiwKICAgICJjb2RUcmlidXRvIiA6IG51bGwsCiAgICAiZGVzY3JpcGNpb24iIDogIkp1ZWdvIGRlIDQgc2FydGVuZXMiLAogICAgInVuaU1lZGlkYSIgOiA1OSwKICAgICJwcmVjaW9VbmkiIDogMjkuNSwKICAgICJtb250b0Rlc2N1IiA6IDAsCiAgICAidmVudGFOb1N1aiIgOiAwLAogICAgInZlbnRhRXhlbnRhIiA6IDAsCiAgICAidmVudGFHcmF2YWRhIiA6IDI5LjUsCiAgICAidHJpYnV0b3MiIDogbnVsbCwKICAgICJwc3YiIDogMCwKICAgICJub0dyYXZhZG8iIDogMCwKICAgICJpdmFJdGVtIiA6IDMuMzkzOAogIH0sIHsKICAgICJudW1JdGVtIiA6IDUsCiAgICAidGlwb0l0ZW0iIDogMSwKICAgICJudW1lcm9Eb2N1bWVudG8iIDogbnVsbCwKICAgICJjYW50aWRhZCIgOiAxLAogICAgImNvZGlnbyIgOiAiUy0yOTQwNSIsCiAgICAiY29kVHJpYnV0byIgOiBudWxsLAogICAgImRlc2NyaXBjaW9uIiA6ICJCaWxsZXRlcmEgZG9ibGUgemlwcGVyIFdLIEFtYXJpbGxvIiwKICAgICJ1bmlNZWRpZGEiIDogNTksCiAgICAicHJlY2lvVW5pIiA6IDUuOTUsCiAgICAibW9udG9EZXNjdSIgOiAwLAogICAgInZlbnRhTm9TdWoiIDogMCwKICAgICJ2ZW50YUV4ZW50YSIgOiAwLAogICAgInZlbnRhR3JhdmFkYSIgOiA1Ljk1LAogICAgInRyaWJ1dG9zIiA6IG51bGwsCiAgICAicHN2IiA6IDAsCiAgICAibm9HcmF2YWRvIiA6IDAsCiAgICAiaXZhSXRlbSIgOiAwLjY4NDUKICB9LCB7CiAgICAibnVtSXRlbSIgOiA2LAogICAgInRpcG9JdGVtIiA6IDEsCiAgICAibnVtZXJvRG9jdW1lbnRvIiA6IG51bGwsCiAgICAiY2FudGlkYWQiIDogMSwKICAgICJjb2RpZ28iIDogIkRLSEQtMTY4IiwKICAgICJjb2RUcmlidXRvIiA6IG51bGwsCiAgICAiZGVzY3JpcGNpb24iIDogIlNldCBkZSBzYWJhbmFzIDQgcGllemFzIEtJTkcgOCIsCiAgICAidW5pTWVkaWRhIiA6IDU5LAogICAgInByZWNpb1VuaSIgOiAxMiwKICAgICJtb250b0Rlc2N1IiA6IDAsCiAgICAidmVudGFOb1N1aiIgOiAwLAogICAgInZlbnRhRXhlbnRhIiA6IDAsCiAgICAidmVudGFHcmF2YWRhIiA6IDEyLAogICAgInRyaWJ1dG9zIiA6IG51bGwsCiAgICAicHN2IiA6IDAsCiAgICAibm9HcmF2YWRvIiA6IDAsCiAgICAiaXZhSXRlbSIgOiAxLjM4MDUKICB9LCB7CiAgICAibnVtSXRlbSIgOiA3LAogICAgInRpcG9JdGVtIiA6IDEsCiAgICAibnVtZXJvRG9jdW1lbnRvIiA6IG51bGwsCiAgICAiY2FudGlkYWQiIDogMSwKICAgICJjb2RpZ28iIDogIkxULTE5MDZQbGFuY2hhIiwKICAgICJjb2RUcmlidXRvIiA6IG51bGwsCiAgICAiZGVzY3JpcGNpb24iIDogIlBsYW5jaGEgQW50aWFkaGVyZW50ZSBDb21hbCBMVC0xOTA4IiwKICAgICJ1bmlNZWRpZGEiIDogNTksCiAgICAicHJlY2lvVW5pIiA6IDE2Ljk1LAogICAgIm1vbnRvRGVzY3UiIDogMCwKICAgICJ2ZW50YU5vU3VqIiA6IDAsCiAgICAidmVudGFFeGVudGEiIDogMCwKICAgICJ2ZW50YUdyYXZhZGEiIDogMTYuOTUsCiAgICAidHJpYnV0b3MiIDogbnVsbCwKICAgICJwc3YiIDogMCwKICAgICJub0dyYXZhZG8iIDogMCwKICAgICJpdmFJdGVtIiA6IDEuOTUKICB9LCB7CiAgICAibnVtSXRlbSIgOiA4LAogICAgInRpcG9JdGVtIiA6IDEsCiAgICAibnVtZXJvRG9jdW1lbnRvIiA6IG51bGwsCiAgICAiY2FudGlkYWQiIDogMSwKICAgICJjb2RpZ28iIDogIkNULTkyMDYzLUsxMSIsCiAgICAiY29kVHJpYnV0byIgOiBudWxsLAogICAgImRlc2NyaXBjaW9uIiA6ICJTZXQgZGUgc8OhYmFuYXMgNC9waWV6YXMgS2luZyBCZWlnZSBPc2N1cm8iLAogICAgInVuaU1lZGlkYSIgOiA1OSwKICAgICJwcmVjaW9VbmkiIDogMTQsCiAgICAibW9udG9EZXNjdSIgOiAwLAogICAgInZlbnRhTm9TdWoiIDogMCwKICAgICJ2ZW50YUV4ZW50YSIgOiAwLAogICAgInZlbnRhR3JhdmFkYSIgOiAxNCwKICAgICJ0cmlidXRvcyIgOiBudWxsLAogICAgInBzdiIgOiAwLAogICAgIm5vR3JhdmFkbyIgOiAwLAogICAgIml2YUl0ZW0iIDogMS42MTA2CiAgfSwgewogICAgIm51bUl0ZW0iIDogOSwKICAgICJ0aXBvSXRlbSIgOiAxLAogICAgIm51bWVyb0RvY3VtZW50byIgOiBudWxsLAogICAgImNhbnRpZGFkIiA6IDEsCiAgICAiY29kaWdvIiA6ICJBLTE5NTMxIiwKICAgICJjb2RUcmlidXRvIiA6IG51bGwsCiAgICAiZGVzY3JpcGNpb24iIDogIkJhbmRvbGVyYSBZVCBkZSA0IHppcHBlciB5IExhbnlhcmQgTmVncm8gIiwKICAgICJ1bmlNZWRpZGEiIDogNTksCiAgICAicHJlY2lvVW5pIiA6IDE0LjUsCiAgICAibW9udG9EZXNjdSIgOiAwLAogICAgInZlbnRhTm9TdWoiIDogMCwKICAgICJ2ZW50YUV4ZW50YSIgOiAwLAogICAgInZlbnRhR3JhdmFkYSIgOiAxNC41LAogICAgInRyaWJ1dG9zIiA6IG51bGwsCiAgICAicHN2IiA6IDAsCiAgICAibm9HcmF2YWRvIiA6IDAsCiAgICAiaXZhSXRlbSIgOiAxLjY2ODEKICB9LCB7CiAgICAibnVtSXRlbSIgOiAxMCwKICAgICJ0aXBvSXRlbSIgOiAxLAogICAgIm51bWVyb0RvY3VtZW50byIgOiBudWxsLAogICAgImNhbnRpZGFkIiA6IDEsCiAgICAiY29kaWdvIiA6ICJCRU5FTEkzMjEyIiwKICAgICJjb2RUcmlidXRvIiA6IG51bGwsCiAgICAiZGVzY3JpcGNpb24iIDogIlNldCBkZSAzIGZvcnJvcyBwYXJhIHNpbGxvbmVzIDMtMi0xIEJFTkVMSTMyMSIsCiAgICAidW5pTWVkaWRhIiA6IDU5LAogICAgInByZWNpb1VuaSIgOiAzMCwKICAgICJtb250b0Rlc2N1IiA6IDAsCiAgICAidmVudGFOb1N1aiIgOiAwLAogICAgInZlbnRhRXhlbnRhIiA6IDAsCiAgICAidmVudGFHcmF2YWRhIiA6IDMwLAogICAgInRyaWJ1dG9zIiA6IG51bGwsCiAgICAicHN2IiA6IDAsCiAgICAibm9HcmF2YWRvIiA6IDAsCiAgICAiaXZhSXRlbSIgOiAzLjQ1MTMKICB9LCB7CiAgICAibnVtSXRlbSIgOiAxMSwKICAgICJ0aXBvSXRlbSIgOiAxLAogICAgIm51bWVyb0RvY3VtZW50byIgOiBudWxsLAogICAgImNhbnRpZGFkIiA6IDEsCiAgICAiY29kaWdvIiA6ICI4NjQzNTEiLAogICAgImNvZFRyaWJ1dG8iIDogbnVsbCwKICAgICJkZXNjcmlwY2lvbiIgOiAiVGFibGFzIGRlIGNvcnRhciAyIHBpZXphcyArIEN1Y2hpbGxvIFZlcmRlIiwKICAgICJ1bmlNZWRpZGEiIDogNTksCiAgICAicHJlY2lvVW5pIiA6IDIuNzUsCiAgICAibW9udG9EZXNjdSIgOiAwLAogICAgInZlbnRhTm9TdWoiIDogMCwKICAgICJ2ZW50YUV4ZW50YSIgOiAwLAogICAgInZlbnRhR3JhdmFkYSIgOiAyLjc1LAogICAgInRyaWJ1dG9zIiA6IG51bGwsCiAgICAicHN2IiA6IDAsCiAgICAibm9HcmF2YWRvIiA6IDAsCiAgICAiaXZhSXRlbSIgOiAwLjMxNjQKICB9LCB7CiAgICAibnVtSXRlbSIgOiAxMiwKICAgICJ0aXBvSXRlbSIgOiAxLAogICAgIm51bWVyb0RvY3VtZW50byIgOiBudWxsLAogICAgImNhbnRpZGFkIiA6IDEsCiAgICAiY29kaWdvIiA6ICJES0hSLTExMDQtMiIsCiAgICAiY29kVHJpYnV0byIgOiBudWxsLAogICAgImRlc2NyaXBjaW9uIiA6ICJWYXNvcyBwbMOhc3RpY29zIDQ1MG1sIG1vcmFkbyDwn5-jIiwKICAgICJ1bmlNZWRpZGEiIDogNTksCiAgICAicHJlY2lvVW5pIiA6IDQuOTUsCiAgICAibW9udG9EZXNjdSIgOiAwLAogICAgInZlbnRhTm9TdWoiIDogMCwKICAgICJ2ZW50YUV4ZW50YSIgOiAwLAogICAgInZlbnRhR3JhdmFkYSIgOiA0Ljk1LAogICAgInRyaWJ1dG9zIiA6IG51bGwsCiAgICAicHN2IiA6IDAsCiAgICAibm9HcmF2YWRvIiA6IDAsCiAgICAiaXZhSXRlbSIgOiAwLjU2OTUKICB9LCB7CiAgICAibnVtSXRlbSIgOiAxMywKICAgICJ0aXBvSXRlbSIgOiAxLAogICAgIm51bWVyb0RvY3VtZW50byIgOiBudWxsLAogICAgImNhbnRpZGFkIiA6IDEsCiAgICAiY29kaWdvIiA6ICJMSEMtOTAxMTAyIiwKICAgICJjb2RUcmlidXRvIiA6IG51bGwsCiAgICAiZGVzY3JpcGNpb24iIDogIkxvbmNoZXJhIGVuIHNldCBkZSAzIEN1YWRyYWRvIEJsYW5jbyIsCiAgICAidW5pTWVkaWRhIiA6IDU5LAogICAgInByZWNpb1VuaSIgOiA5LjUsCiAgICAibW9udG9EZXNjdSIgOiAwLAogICAgInZlbnRhTm9TdWoiIDogMCwKICAgICJ2ZW50YUV4ZW50YSIgOiAwLAogICAgInZlbnRhR3JhdmFkYSIgOiA5LjUsCiAgICAidHJpYnV0b3MiIDogbnVsbCwKICAgICJwc3YiIDogMCwKICAgICJub0dyYXZhZG8iIDogMCwKICAgICJpdmFJdGVtIiA6IDEuMDkyOQogIH0sIHsKICAgICJudW1JdGVtIiA6IDE0LAogICAgInRpcG9JdGVtIiA6IDEsCiAgICAibnVtZXJvRG9jdW1lbnRvIiA6IG51bGwsCiAgICAiY2FudGlkYWQiIDogMSwKICAgICJjb2RpZ28iIDogIkVWMTIyMTEiLAogICAgImNvZFRyaWJ1dG8iIDogbnVsbCwKICAgICJkZXNjcmlwY2lvbiIgOiAiU21hcnR3YXRjaCArIEF1ZMOtZm9ub3MgTmVncm8iLAogICAgInVuaU1lZGlkYSIgOiA1OSwKICAgICJwcmVjaW9VbmkiIDogMTMsCiAgICAibW9udG9EZXNjdSIgOiAwLAogICAgInZlbnRhTm9TdWoiIDogMCwKICAgICJ2ZW50YUV4ZW50YSIgOiAwLAogICAgInZlbnRhR3JhdmFkYSIgOiAxMywKICAgICJ0cmlidXRvcyIgOiBudWxsLAogICAgInBzdiIgOiAwLAogICAgIm5vR3JhdmFkbyIgOiAwLAogICAgIml2YUl0ZW0iIDogMS40OTU2CiAgfSwgewogICAgIm51bUl0ZW0iIDogMTUsCiAgICAidGlwb0l0ZW0iIDogMSwKICAgICJudW1lcm9Eb2N1bWVudG8iIDogbnVsbCwKICAgICJjYW50aWRhZCIgOiAxLAogICAgImNvZGlnbyIgOiAiQS0yMTIzMiIsCiAgICAiY29kVHJpYnV0byIgOiBudWxsLAogICAgImRlc2NyaXBjaW9uIiA6ICJMb25jaGVyYSBUw6lybWljYSBCZW50byBOZWdybyIsCiAgICAidW5pTWVkaWRhIiA6IDU5LAogICAgInByZWNpb1VuaSIgOiA1LAogICAgIm1vbnRvRGVzY3UiIDogMCwKICAgICJ2ZW50YU5vU3VqIiA6IDAsCiAgICAidmVudGFFeGVudGEiIDogMCwKICAgICJ2ZW50YUdyYXZhZGEiIDogNSwKICAgICJ0cmlidXRvcyIgOiBudWxsLAogICAgInBzdiIgOiAwLAogICAgIm5vR3JhdmFkbyIgOiAwLAogICAgIml2YUl0ZW0iIDogMC41NzUyCiAgfSwgewogICAgIm51bUl0ZW0iIDogMTYsCiAgICAidGlwb0l0ZW0iIDogMSwKICAgICJudW1lcm9Eb2N1bWVudG8iIDogbnVsbCwKICAgICJjYW50aWRhZCIgOiAxLAogICAgImNvZGlnbyIgOiAiTlM0MDY5MzU3IiwKICAgICJjb2RUcmlidXRvIiA6IG51bGwsCiAgICAiZGVzY3JpcGNpb24iIDogIkNhamEgbWV0w6FsaWNhIHBhcmEgb3JnYW5pemFyIGRpbmVybyBOZWdybyBkZSAyMGNtIiwKICAgICJ1bmlNZWRpZGEiIDogNTksCiAgICAicHJlY2lvVW5pIiA6IDExLAogICAgIm1vbnRvRGVzY3UiIDogMCwKICAgICJ2ZW50YU5vU3VqIiA6IDAsCiAgICAidmVudGFFeGVudGEiIDogMCwKICAgICJ2ZW50YUdyYXZhZGEiIDogMTEsCiAgICAidHJpYnV0b3MiIDogbnVsbCwKICAgICJwc3YiIDogMCwKICAgICJub0dyYXZhZG8iIDogMCwKICAgICJpdmFJdGVtIiA6IDEuMjY1NQogIH0gXSwKICAicmVzdW1lbiIgOiB7CiAgICAidG90YWxOb1N1aiIgOiAwLAogICAgInRvdGFsRXhlbnRhIiA6IDAsCiAgICAidG90YWxHcmF2YWRhIiA6IDE4Mi41NSwKICAgICJzdWJUb3RhbFZlbnRhcyIgOiAxODIuNTUsCiAgICAiZGVzY3VOb1N1aiIgOiAwLAogICAgImRlc2N1RXhlbnRhIiA6IDAsCiAgICAiZGVzY3VHcmF2YWRhIiA6IDAsCiAgICAicG9yY2VudGFqZURlc2N1ZW50byIgOiAwLAogICAgInRvdGFsRGVzY3UiIDogMCwKICAgICJ0cmlidXRvcyIgOiBudWxsLAogICAgInN1YlRvdGFsIiA6IDE4Mi41NSwKICAgICJpdmFSZXRlMSIgOiAwLAogICAgInJldGVSZW50YSIgOiAwLAogICAgIm1vbnRvVG90YWxPcGVyYWNpb24iIDogMTgyLjU1LAogICAgInRvdGFsTm9HcmF2YWRvIiA6IDAsCiAgICAidG90YWxQYWdhciIgOiAxODIuNTUsCiAgICAidG90YWxMZXRyYXMiIDogIkNJRU5UTyBPQ0hFTlRBIFkgRE9TIDU1LzEwMCBET0xBUkVTIiwKICAgICJ0b3RhbEl2YSIgOiAyMSwKICAgICJzYWxkb0Zhdm9yIiA6IDAsCiAgICAiY29uZGljaW9uT3BlcmFjaW9uIiA6IDEsCiAgICAicGFnb3MiIDogbnVsbCwKICAgICJudW1QYWdvRWxlY3Ryb25pY28iIDogbnVsbAogIH0sCiAgImV4dGVuc2lvbiIgOiB7CiAgICAibm9tYkVudHJlZ2EiIDogIk5hdGhhbGllIENhcnJhbnphIiwKICAgICJkb2N1RW50cmVnYSIgOiBudWxsLAogICAgIm5vbWJSZWNpYmUiIDogbnVsbCwKICAgICJkb2N1UmVjaWJlIiA6IG51bGwsCiAgICAib2JzZXJ2YWNpb25lcyIgOiBudWxsLAogICAgInBsYWNhVmVoaWN1bG8iIDogbnVsbAogIH0sCiAgImFwZW5kaWNlIiA6IG51bGwKfQ.Dkc7VrtznE45EtINTB0ZGAXOQ45ndWD9g5todKYJBvAX9s1RQ3kt6fnW8ULgzchopf5_5gGg0fy8ngmLj7HVg7BdG3YCkocljRTSe49_hv4Z_jGiGUr2XUX8z65HhReDGbbp7ZysFV9WyseM5tgKq3uBaufUdHH-Sjl5YVBtUGVvo0FFdxc1V5GvFHPbtemJDs5SXe5JX45gyg6hajwBfQOiaWFbEAXQbI1VrJYiMNM6xYze0aB1BHJjpJ3kvroe0IQvRw3y2LIU-IbtUmHgjmm7l2en-1HdFjX52epzgF-_Z0ijigGnYKCm3vqkC9R3axbNjLKkKTFLqELGHfNvYQ";

    //     let dte = await DTE_Model.create({
    //         sale: null,
    //         sucursal: 2,
    //         caja: 2,
    //         codigo: "E9FC9186-D8C2-40F6-9BDB-6B402F96F759",
    //         contingencia: null,
    //         tipo: "01",
    //         trasnmitido: true,
    //         entregado: true,
    //         responseMH: {
    //             "version": 2,
    //             "ambiente": "01",
    //             "versionApp": 2,
    //             "estado": "PROCESADO",
    //             "codigoGeneracion": "E9FC9186-D8C2-40F6-9BDB-6B402F96F759",
    //             "selloRecibido": "202557EF8A8A75084F68824B333025D94AA2TKZK",
    //             "fhProcesamiento": "03/07/2025 09:59:43",
    //             "clasificaMsg": "10",
    //             "codigoMsg": "001",
    //             "descripcionMsg": "RECIBIDO",
    //             "observaciones": []
    //         },
    //         correlativo: 44,
    //         dte: {
    //             "identificacion": {
    //                 version: 1,
    //                 ambiente: "01",
    //                 tipoDte: "01",
    //                 numeroControl: "DTE-01-S004P001-000000000000044",
    //                 codigoGeneracion: "E9FC9186-D8C2-40F6-9BDB-6B402F96F759",
    //                 tipoModelo: 1,
    //                 tipoOperacion: 1,
    //                 fecEmi: "2025-07-03",
    //                 horEmi: "09:59:42",
    //                 tipoMoneda: "USD",
    //                 tipoContingencia: null,
    //                 motivoContin: null
    //             },
    //             "documentoRelacionado": null,
    //             "emisor": {
    //                 "nit": "061403318",
    //                 "nrc": "3359852",
    //                 "nombre": "Gerardo Alfonso Rivera Cortez",
    //                 "codActividad": "10006",
    //                 "descActividad": "Comerciante",
    //                 "nombreComercial": "Riveras Group",
    //                 "tipoEstablecimiento": "01",
    //                 "direccion": {
    //                     "departamento": "02",
    //                     "municipio": "15",
    //                     "complemento": "3A, Calle Oriente y 1A. AV Sur Esquina, Local 1"
    //                 }, "telefono": "25278683", "correo": "facturacion@riverasgroup.com", "codEstableMH": "S004", "codEstable": "S004", "codPuntoVentaMH": "P001", "codPuntoVenta": "P001"
    //             }, 
    //             "receptor": { "tipoDocumento": "13", "numDocumento": "04219420-1", "nrc": null, "nombre": "Sandy Yomara Uto de Pin", "codActividad": null, "descActividad": null, "direccion": { "departamento": "02", "municipio": "15", "complemento": "Riveras Group Santa Ana" }, "telefono": "78587349", "correo": "sandyyomijimenezdepin@gmail.com" }, 
    //             "otrosDocumentos": null, 
    //             "ventaTercero": null, 
    //             "cuerpoDocumento": [
    //                 { "numItem": 1, "tipoItem": 1, "numeroDocumento": null, "cantidad": 1, "codigo": "STR-61013", "codTributo": null, "descripcion": "Estuche para Laptop Negro", "uniMedida": 59, "precioUni": 7, "montoDescu": 0, "ventaNoSuj": 0, "ventaExenta": 0, "ventaGravada": 7, "tributos": null, "psv": 0, "noGravado": 0, "ivaItem": 0.8053 }, 
    //                 { "numItem": 2, "tipoItem": 1, "numeroDocumento": null, "cantidad": 1, "codigo": "S-37371", "codTributo": null, "descripcion": "Mini Billetera Inspiración Vogue Café Claro", "uniMedida": 59, "precioUni": 3.95, "montoDescu": 0, "ventaNoSuj": 0, "ventaExenta": 0, "ventaGravada": 3.95, "tributos": null, "psv": 0, "noGravado": 0, "ivaItem": 0.4544 },
    //                 { "numItem": 3, "tipoItem": 1, "numeroDocumento": null, "cantidad": 1, "codigo": "883351", "codTributo": null, "descripcion": "Tijera de Podar Negro", "uniMedida": 59, "precioUni": 2.5, "montoDescu": 0, "ventaNoSuj": 0, "ventaExenta": 0, "ventaGravada": 2.5, "tributos": null, "psv": 0, "noGravado": 0, "ivaItem": 0.2876 },
    //                 { "numItem": 4, "tipoItem": 1, "numeroDocumento": null, "cantidad": 1, "codigo": "LHC-FR044", "codTributo": null, "descripcion": "Juego de 4 sartenes", "uniMedida": 59, "precioUni": 29.5, "montoDescu": 0, "ventaNoSuj": 0, "ventaExenta": 0, "ventaGravada": 29.5, "tributos": null, "psv": 0, "noGravado": 0, "ivaItem": 3.3938 },
    //                 { "numItem": 5, "tipoItem": 1, "numeroDocumento": null, "cantidad": 1, "codigo": "S-29405", "codTributo": null, "descripcion": "Billetera doble zipper WK Amarillo", "uniMedida": 59, "precioUni": 5.95, "montoDescu": 0, "ventaNoSuj": 0, "ventaExenta": 0, "ventaGravada": 5.95, "tributos": null, "psv": 0, "noGravado": 0, "ivaItem": 0.6845 },
    //                 { "numItem": 6, "tipoItem": 1, "numeroDocumento": null, "cantidad": 1, "codigo": "DKHD-168", "codTributo": null, "descripcion": "Set de sabanas 4 piezas KING 8", "uniMedida": 59, "precioUni": 12, "montoDescu": 0, "ventaNoSuj": 0, "ventaExenta": 0, "ventaGravada": 12, "tributos": null, "psv": 0, "noGravado": 0, "ivaItem": 1.3805 }, { "numItem": 7, "tipoItem": 1, "numeroDocumento": null, "cantidad": 1, "codigo": "LT-1906Plancha", "codTributo": null, "descripcion": "Plancha Antiadherente Comal LT-1908", "uniMedida": 59, "precioUni": 16.95, "montoDescu": 0, "ventaNoSuj": 0, "ventaExenta": 0, "ventaGravada": 16.95, "tributos": null, "psv": 0, "noGravado": 0, "ivaItem": 1.95 }, { "numItem": 8, "tipoItem": 1, "numeroDocumento": null, "cantidad": 1, "codigo": "CT-92063-K11", "codTributo": null, "descripcion": "Set de sábanas 4/piezas King Beige Oscuro", "uniMedida": 59, "precioUni": 14, "montoDescu": 0, "ventaNoSuj": 0, "ventaExenta": 0, "ventaGravada": 14, "tributos": null, "psv": 0, "noGravado": 0, "ivaItem": 1.6106 }, { "numItem": 9, "tipoItem": 1, "numeroDocumento": null, "cantidad": 1, "codigo": "A-19531", "codTributo": null, "descripcion": "Bandolera YT de 4 zipper y Lanyard Negro ", "uniMedida": 59, "precioUni": 14.5, "montoDescu": 0, "ventaNoSuj": 0, "ventaExenta": 0, "ventaGravada": 14.5, "tributos": null, "psv": 0, "noGravado": 0, "ivaItem": 1.6681 }, { "numItem": 10, "tipoItem": 1, "numeroDocumento": null, "cantidad": 1, "codigo": "BENELI3212", "codTributo": null, "descripcion": "Set de 3 forros para sillones 3-2-1 BENELI321", "uniMedida": 59, "precioUni": 30, "montoDescu": 0, "ventaNoSuj": 0, "ventaExenta": 0, "ventaGravada": 30, "tributos": null, "psv": 0, "noGravado": 0, "ivaItem": 3.4513 }, { "numItem": 11, "tipoItem": 1, "numeroDocumento": null, "cantidad": 1, "codigo": "864351", "codTributo": null, "descripcion": "Tablas de cortar 2 piezas + Cuchillo Verde", "uniMedida": 59, "precioUni": 2.75, "montoDescu": 0, "ventaNoSuj": 0, "ventaExenta": 0, "ventaGravada": 2.75, "tributos": null, "psv": 0, "noGravado": 0, "ivaItem": 0.3164 }, { "numItem": 12, "tipoItem": 1, "numeroDocumento": null, "cantidad": 1, "codigo": "DKHR-1104-2", "codTributo": null, "descripcion": "Vasos plásticos 450ml morado", "uniMedida": 59, "precioUni": 4.95, "montoDescu": 0, "ventaNoSuj": 0, "ventaExenta": 0, "ventaGravada": 4.95, "tributos": null, "psv": 0, "noGravado": 0, "ivaItem": 0.5695 }, { "numItem": 13, "tipoItem": 1, "numeroDocumento": null, "cantidad": 1, "codigo": "LHC-901102", "codTributo": null, "descripcion": "Lonchera en set de 3 Cuadrado Blanco", "uniMedida": 59, "precioUni": 9.5, "montoDescu": 0, "ventaNoSuj": 0, "ventaExenta": 0, "ventaGravada": 9.5, "tributos": null, "psv": 0, "noGravado": 0, "ivaItem": 1.0929 }, { "numItem": 14, "tipoItem": 1, "numeroDocumento": null, "cantidad": 1, "codigo": "EV12211", "codTributo": null, "descripcion": "Smartwatch + Audífonos Negro", "uniMedida": 59, "precioUni": 13, "montoDescu": 0, "ventaNoSuj": 0, "ventaExenta": 0, "ventaGravada": 13, "tributos": null, "psv": 0, "noGravado": 0, "ivaItem": 1.4956 }, { "numItem": 15, "tipoItem": 1, "numeroDocumento": null, "cantidad": 1, "codigo": "A-21232", "codTributo": null, "descripcion": "Lonchera Térmica Bento Negro", "uniMedida": 59, "precioUni": 5, "montoDescu": 0, "ventaNoSuj": 0, "ventaExenta": 0, "ventaGravada": 5, "tributos": null, "psv": 0, "noGravado": 0, "ivaItem": 0.5752 }, { "numItem": 16, "tipoItem": 1, "numeroDocumento": null, "cantidad": 1, "codigo": "NS4069357", "codTributo": null, "descripcion": "Caja metálica para organizar dinero Negro de 20cm", "uniMedida": 59, "precioUni": 11, "montoDescu": 0, "ventaNoSuj": 0, "ventaExenta": 0, "ventaGravada": 11, "tributos": null, "psv": 0, "noGravado": 0, "ivaItem": 1.2655 }], "resumen": { "totalNoSuj": 0, "totalExenta": 0, "totalGravada": 182.55, "subTotalVentas": 182.55, "descuNoSuj": 0, "descuExenta": 0, "descuGravada": 0, "porcentajeDescuento": 0, "totalDescu": 0, "tributos": null, "subTotal": 182.55, "ivaRete1": 0, "reteRenta": 0, "montoTotalOperacion": 182.55, "totalNoGravado": 0, "totalPagar": 182.55, "totalLetras": "CIENTO OCHENTA Y DOS 55/100 DOLARES", "totalIva": 21, "saldoFavor": 0, "condicionOperacion": 1, "pagos": null, "numPagoElectronico": null },
    //             "extension": {
    //                 "nombEntrega": "Nathalie Carranza",
    //                 "docuEntrega": null,
    //                 "nombRecibe": null,
    //                 "docuRecibe": null,
    //                 "observaciones": null,
    //                 "placaVehiculo": null
    //             },
    //             "apendice": null,
    //             "selloRecibido": "202557EF8A8A75084F68824B333025D94AA2TKZK",
    //             "firmaElectronica": firma
    //         },
    //         intentos: 1,
    //         _errors: null,
    //         fecEmi: "2025-07-03",
    //         client_label: "Sandy Yomara Uto de Pin",
    //         invalidacion: null,
    //         nc: null,
    //     });

    //     return res.json(dte);


    // }






};