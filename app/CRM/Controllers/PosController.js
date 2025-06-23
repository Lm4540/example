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
let helper_url = process.env.PDF_GENERATION_URL;


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

            let data = {
                emisor_direction: `${dte.dte.emisor.direccion.complemento}, ${municipios[dte.dte.emisor.direccion.departamento][dte.dte.emisor.direccion.municipio]}, ${departamentos[dte.dte.emisor.direccion.departamento]?.toUpperCase()}`,
                receptor: {
                    documento: dte.dte.receptor.tipoDocumento && dte.dte.receptor.numDocumento ? `${documentos[dte.dte.receptor.tipoDocumento]} (${dte.dte.receptor.numDocumento})` : "",
                    direccion: dte.dte.receptor.direccion !== null ? `${dte.dte.receptor.direccion.complemento}, ${municipios[dte.dte.receptor.direccion.departamento][dte.dte.receptor.direccion.municipio]}, ${departamentos[dte.dte.receptor.direccion.departamento]?.toUpperCase()}` : "",
                }
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

            let data = {
                emisor_direction: `${dte.dte.emisor.direccion.complemento}, ${municipios[dte.dte.emisor.direccion.departamento][dte.dte.emisor.direccion.municipio]}, ${departamentos[dte.dte.emisor.direccion.departamento]?.toUpperCase()}`,
                receptor: {
                    documento: dte.dte.receptor.tipoDocumento && dte.dte.receptor.numDocumento ? `${documentos[dte.dte.receptor.tipoDocumento]} (${dte.dte.receptor.numDocumento})` : "",
                    direccion: dte.dte.receptor.direccion !== null ? `${dte.dte.receptor.direccion.complemento}, ${municipios[dte.dte.receptor.direccion.departamento][dte.dte.receptor.direccion.municipio]}, ${departamentos[dte.dte.receptor.direccion.departamento]?.toUpperCase()}` : "",
                }
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

            let data = {
                emisor_direction: `${dte.dte.emisor.direccion.complemento}, ${municipios[dte.dte.emisor.direccion.departamento][dte.dte.emisor.direccion.municipio]}, ${departamentos[dte.dte.emisor.direccion.departamento]?.toUpperCase()}`,
                receptor: {
                    documento: dte.dte.receptor.tipoDocumento && dte.dte.receptor.numDocumento ? `${documentos[dte.dte.receptor.tipoDocumento]} (${dte.dte.receptor.numDocumento})` : "",
                    direccion: dte.dte.receptor.direccion !== null ? `${dte.dte.receptor.direccion.complemento}, ${municipios[dte.dte.receptor.direccion.departamento][dte.dte.receptor.direccion.municipio]}, ${departamentos[dte.dte.receptor.direccion.departamento]?.toUpperCase()}` : "",
                }
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
        tmp.forEach(element => { clients[element.id] = element; });



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
                        gravadas = Helper.fix_number(detail.cant * detail.price), 4;
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
                    let gravadas = 0.00, exenta = 0;
                    let price = Helper.fix_number(detail.price / (1 + valor_iva), 4);

                    gravadas = (detail.cant * price);
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

                    dte_json.selloRecibido = enviado.data.selloRecibido;
                    dte_json.firmaElectronica = enviado.firma;

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
                        correlativo: dte_correlativo.correlativo,
                        dte: dte_json,
                        intentos: 1,
                        _errors: null
                    }

                    //enviar el DTE
                    if (enviado.status === 'errorContingencia') {
                        dteModel.intentos = process.env.MH_API_MAX_RETRIES;
                    } else if (enviado.status === 'success') {
                        dteModel.trasnmitido = true;
                        dteModel.responseMH = enviado.data;
                    }

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
                        if (sale._status == "process") { sale._status = "closed"; }
                        await sale.save({ transaction: t });

                        if (client.correo !== null && client.correo !== "") {
                            //enviar correo
                            axios.get(`${helper_url}/utils/services/sendPDF/${dteModel.id}?dummy_key=03b10bac1ef3b941?hl=es`)
                                .then(response => { console.log(response) });
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


    }

};