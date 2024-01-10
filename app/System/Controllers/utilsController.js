const axios = require('axios').default;
const Sucursal = require('../../Inventory/Models/Sucursal');
const Client = require("../../CRM/Models/Client");
const Sale = require('../../CRM/Models/Sale');
const SaleDetail = require('../../CRM/Models/SaleDetail');
const InvoiceSeries = require('../../CRM/Models/InvoiceSerie');
const SalePayment = require('../../CRM/Models/SalePayment');
const Product = require('../../Inventory/Models/Product');
const Stock = require('../../Inventory/Models/Stock');
const StockReserve = require('../../Inventory/Models/StockReserve');
const ClientObservation = require('../../CRM/Models/ClientObservation');
const Movement = require("../../Inventory/Models/Movement");
const Provider = require("../../Inventory/Models/Provider");
const PettyCashMoves = require('../../Financial/Models/PettyCashMoves');
const Employee = require('../../HRM/Models/Employee');


const Helper = require('../../System/Helpers');
const sequelize = require("../../DataBase/DataBase");
const { Op, QueryTypes } = require("sequelize");
const UtilsController = {

    index: async (req, res) => {
        return res.render('Utils/index', { pageTitle: 'Utilidades' });
    },


    revoke_order: async (req, res) => {
        if(!req.session.userSession.permission.includes('revoke_sales')){
            return res.json({
                status: 'errorMessage', message: "No tienes permiso para realizar esta operación"
            });
        }

        let invoice = await Sale.findByPk(req.body.sale);

        if (invoice) {

            if (invoice._status == 'process' || invoice._status == 'closed' || invoice._status == "prepared"){

                try {
                    return await sequelize.transaction(async (t) => {
                        let details = null;
                        if (invoice.collected > 0.00) {
                            return res.json({
                                status: 'errorMessage', message: "No se puede anular esta venta porque tiene pagos asignados, reasigne los pagos para poder Anular esta venta"
                            });
                        }  else if (invoice.invoice_number !== null) {
                            return res.json({
                                status: 'errorMessage', message: "No se puede anular esta venta porque ya ha Facturado"
                            });
                        }
    
                        //buscar el cliente y hacerle una anotacion para que quede costancia
                        let observation = await ClientObservation.create({
                            client: invoice.client,
                            createdBy: req.session.userSession.shortName,
                            observation: `Se Libero un pedido de $${Helper.money_format(Helper.fix_number(invoice.balance + invoice.delivery_amount))}`,
                        }, { transaction: t }).catch(e => next(e));
    
    
                        //Anular la venta
                        invoice._status = 'revoked';
                        invoice.revoked_at = new Date();
                        invoice.revoked_reason = req.body.reason;
                        invoice.collected = 0.00;
                        invoice.cost = 0.00;
                        invoice.payments = null;
                        invoice.in_report = false;
                        await invoice.save({ transaction: t });
    
                        //Liberar los detalles
                        details = await SaleDetail.findAll({
                            where: {
                                sale: invoice.id
                            }
                        }, { transaction: t });
                        let len = details.length;
                        for (let index = 0; index < len; index++) {
                            let detail = details[index];
                            let reserves = await StockReserve.findAll({
                                where: {
                                    saleId: detail.id
                                }
                            }, { transaction: t });
    
                            let largo = reserves.length;
                            for (let a = 0; a < largo; a++) {
                                let reserve = reserves[a];
                                let stock = await Stock.findOne({
                                    where: {
                                        sucursal: reserve.sucursal,
                                        product: reserve.product
                                    }
                                }, { transaction: t });
                                if (stock) {
                                    stock.reserved -= reserve.cant;
                                    await stock.save({ transaction: t });
                                }
    
    
                                let product = await Product.findByPk(reserve.product);
                                if (product) {
                                    product.reserved -= reserve.cant;
                                    await product.save({ transaction: t });
                                }
                                await reserve.destroy({ transaction: t });
                            }
                            //actualizar el detalle
    
                            detail.delivered = 0;
                            detail.reserved = 0;
                            detail.ready = 0;
                            await detail.save({ transaction: t });
                        }
    
                        return res.json({
                            status: 'success', invoice: invoice,
                        });
    
                    });
    
                } catch (error) {
                    return res.json({
                        status: 'error', message: "Internal Server Error", error: error.message
                    });
                }
            }

            return res.json({
                status: 'errorMessage', message: "No se puede anular esta venta porque ya ha anulado, ya ha sido entregado el producto o recolectado el pago, por favor anule unicamente la factura"
            });


        }
        return res.json({
            status: 'errorMessage', message: "Order not Found"
        });

    },

    open_order: async (req, res) => {

        if(!req.session.userSession.permission.includes('reopen_sales')){
            return res.json({
                status: 'errorMessage', message: "No tienes permiso para realizar esta operación"
            });
        }
        let invoice = await Sale.findByPk(req.body.order);

        if (invoice) {

            try {
                return await sequelize.transaction(async (t) => {
                    let details = null;
                    if (invoice._status == 'closed' || invoice._status == 'prepared') {
                        if (invoice.collected > 0.00) {
                            return res.json({
                                status: 'errorMessage', message: "No se puede abrir esta venta porque tiene pagos asignados, reasigne los pagos para poder Abrir"
                            });
                        }
                        if (invoice.invoice_number !== null) {
                            return res.json({
                                status: 'errorMessage', message: "No se puede abrir esta venta porque ya ha Facturado la misma"
                            });
                        }
                        //Anular la venta
                        invoice._status = 'process';
                        invoice.in_report = false;
                        await invoice.save({ transaction: t });

                        return res.json({
                            status: 'success', invoice: invoice,
                        });
                    } 
                    return res.json({
                        status: 'errorMessage', message: "No se puede abrir esta venta"
                    });
                });
            } catch (error) {
                return res.json({
                    status: 'error', message: "Internal Server Error", error: error.message
                });
            }
        }
        return res.json({
            status: 'errorMessage', message: "Order not Found"
        });
    },


    getImageFromUrl: async (req, res) => {
        try {
            let url = req.query.link;
            console.log(url);
            let image = await axios.get(url, { responseType: 'arraybuffer' });
            res.send('data:image/jpg;base64,' + Buffer.from(image.data).toString('base64'));
            //res.send('this is a response');
        } catch (error) {
            console.log(error)
        }


        /*
        try {
            const url = req.query.url;
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            res.writeHead(200, {
                'Content-Type': 'image/jpeg',
                'Content-Length': response.data.byteLength
            });
            res.end(Buffer.from(response.data).toString('base64'));
        } catch (error) {
            console.log(error);
            res.status(404).send("This URL not contains Image or itsn't available");
        }
        */
    },


};

module.exports = UtilsController;