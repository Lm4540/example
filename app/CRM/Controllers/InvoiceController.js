const Client = require("../Models/Client");
const InvoiceSeries = require("../Models/InvoiceSerie");
const Sale = require("../Models/Sale");
const SaleDetail = require("../Models/SaleDetail");
const Sucursal = require("../../Inventory/Models/Sucursal");
const SalePayment = require("../Models/SalePayment");
const Product = require('../../Inventory/Models/Product');
const Stock = require('../../Inventory/Models/Stock');
const StockReserve = require('../../Inventory/Models/StockReserve');
const sequelize = require("../../DataBase/DataBase");
const DTE = require('../../DTE/Models/DTE');

const { Op, QueryTypes } = require("sequelize");
const Helper = require("../../System/Helpers");
const types = {
    'ccf': 'Comporbante de Credito Fiscal',
    'fcf': "Factura de Consumidor Final",
    'fex': "Factura de Exportacion",
    'nr': "Nota de Remisión",
    'nc': "Nota de Credito",
    'nd': "Nota de Debito",
};



const InvoiceController = {



    add_taxes: async (req, res) => {

        let sales = await Sale.findAll({
            where: {
                taxes: {
                    [Op.is]: null
                }
            },
            limit: 1000
        });

        try {
            return await sequelize.transaction(async (t) => {
                for (let aa = 0; aa < sales.length; aa++) {
                    let invoice = sales[aa];

                    let sin_iva = Helper.fix_number(invoice.balance / 1.13);
                    invoice.taxes = {
                        iva: Helper.fix_number(invoice.balance - sin_iva),
                        retention: invoice.invoice_retention && sin_iva > 100 ? Helper.fix_number(sin_iva * process.env.RETENTION) : 0.00,
                        perception: 0.00,
                        isr: invoice.invoice_retention ? Helper.fix_number(sin_iva * process.env.RET_ISR) : 0.00,
                    }

                    await invoice.save({ transaccion: t });

                    let old_date = new Date(invoice.invoice_date);
                    let now = new Date();

                    if (invoice.invoice_number !== null && invoice._status == "collected" && invoice.in_report == true && old_date.getMonth() < now.getMonth()) {
                        await sequelize.query('update crm_sale set locked = 1 where id = :_id', {
                            replacements: {
                                _id: invoice.id,
                            },
                            type: QueryTypes.UPDATE,
                            transaction: t
                        });
                    }
                }
                return res.json({
                    status: 'success',
                    message: 'Operacion realizada con exito',
                })
            });
        } catch (error) {
            console.log(error.message);
            return res.json({
                status: "error", errorMessage: error.message,
            })
        }

    },

    revoke_invoice: async (req, res) => {
        let data = req.body;
        let invoice = await Sale.findOne({
            where: {
                invoice_number: data.number,
                invoce_serie: data.serie,
            }
        });

        if (invoice) {

            try {
                return await sequelize.transaction(async (t) => {
                    let cData = null, details = null;
                    switch (data.option) {
                        case '1':
                            //duplicar la venta
                            cData = await Sale.findOne({ where: { id: invoice.id, }, raw: true, }, { transaction: t });

                            delete cData.id;
                            new_model = await Sale.create(cData, { transaction: t });

                            //Duplicar los detalles sin reservas ni IDS

                            details = await SaleDetail.findAll({
                                where: {
                                    sale: invoice.id
                                }, raw: true,
                            }, { transaction: t });


                            for (let index = 0; index < details.length; index++) {
                                let detail = details[index];
                                let new_detail = await SaleDetail.create({
                                    sale: new_model.id,
                                    product: detail.product,
                                    price: detail.price,
                                    description: detail.description,
                                    image: detail.image,
                                    _order: detail._order,
                                    cant: detail.cant,
                                    ready: 0,
                                    delivered: 0,
                                    reserved: 0,
                                    to_reverse: 0,
                                    product_cost: 0,
                                    history: detail.history,
                                    invoice_column: detail.invoice_column,
                                }, { transaction: t });
                            }

                            //Anular la venta
                            new_model._status = 'revoked';
                            new_model.revoked_at = new Date();
                            new_model.revoked_reason = 'Factura Anulada';
                            new_model.collected = 0.00;
                            new_model.cost = 0.00;
                            new_model.payments = null;
                            new_model.in_report = false;
                            new_model.invoice_data = invoice.invoice_data;
                            await new_model.save({ transaction: t });

                            invoice.invoce_serie = null;
                            invoice.invoice_type = null;
                            invoice.invoice_number = null;
                            invoice.invoice_resume = null;
                            invoice.invoice_data = null;
                            invoice.dte = null;
                            invoice.invoice_date = null;
                            await invoice.save({ transaction: t });

                            return res.json({
                                status: 'success', invoice: invoice,
                            });

                            break;



                        case '2':
                            if (invoice.collected > 0.00) {
                                return res.json({
                                    status: 'errorMessage', message: "No se puede anular esta venta porque tiene pagos asignados, reasigne los pagos para poder Anular esta venta"
                                });
                            } else if (invoice._status == 'delivered' || invoice._status == "collected") {
                                return res.json({
                                    status: 'errorMessage', message: "No se puede anular esta venta porque ya ha sido entregado el producto o recolectado el pago, por favor anule unicamente la factura"
                                });
                            }

                            //Anular la venta
                            invoice._status = 'revoked';
                            invoice.revoked_at = new Date();
                            invoice.revoked_reason = 'Factura Anulada';
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
                            break;

                        case '3':
                            //Validar el numero de serie
                            let existe = await Sale.findOne({
                                where: {
                                    invoice_number: data.invoice_number,
                                    invoce_serie: data.invoice_serie
                                }
                            });

                            if (existe) {
                                return res.json({
                                    status: 'errorMessage', message: "Ya hay una factura registrada con este Numero para la serie seleccionada"
                                });
                            }

                            //duplicar la venta
                            cData = await Sale.findOne({ where: { id: invoice.id, }, raw: true, }, { transaction: t });

                            delete cData.id;
                            new_model = await Sale.create(cData, { transaction: t });

                            //Duplicar los detalles sin reservas ni IDS

                            details = await SaleDetail.findAll({
                                where: {
                                    sale: invoice.id
                                }, raw: true,
                            }, { transaction: t });


                            for (let index = 0; index < details.length; index++) {
                                let detail = details[index];
                                let new_detail = await SaleDetail.create({
                                    sale: new_model.id,
                                    product: detail.product,
                                    price: detail.price,
                                    description: detail.description,
                                    image: detail.image,
                                    _order: detail._order,
                                    cant: detail.cant,
                                    ready: 0,
                                    delivered: 0,
                                    reserved: 0,
                                    to_reverse: 0,
                                    product_cost: 0,
                                    history: detail.history,
                                    invoice_column: detail.invoice_column,
                                }, { transaction: t });
                            }

                            //Anular la venta
                            new_model._status = 'revoked';
                            new_model.revoked_at = new Date();
                            new_model.revoked_reason = 'Factura Anulada';
                            new_model.collected = 0.00;
                            new_model.cost = 0.00;
                            new_model.payments = null;
                            new_model.in_report = false;
                            new_model.invoice_data = invoice.invoice_data;
                            new_model.taxes = invoice.taxes;
                            await new_model.save({ transaction: t });

                            invoice.invoce_serie = data.invoice_serie;
                            invoice.invoice_type = data.invoice_type;
                            invoice.invoice_number = data.invoice_number;
                            invoice.invoice_resume = data.invoice_resume.length > 0 ? data.invoice_resume : null;
                            invoice.invoice_data = data.data;
                            invoice.dte = null;
                            invoice.invoice_retention = data.invoice_retention;
                            invoice.invoice_isr = data.invoice_isr;
                            invoice.invoice_date = new Date(data.invoice_date+"T06:00:00");


                            //Actualizar los taxes segun las opciones seleccionadas

                            let sin_iva = Helper.fix_number(invoice.balance / 1.13);
                            invoice.taxes = {
                                iva: Helper.fix_number(invoice.balance - sin_iva),
                                retention: invoice.invoice_retention && sin_iva > 100 ? Helper.fix_number(sin_iva * process.env.RETENTION) : 0.00,
                                perception: 0.00,
                                isr: invoice.invoice_isr ? Helper.fix_number(sin_iva * process.env.RET_ISR) : 0.00,
                            }


                            await invoice.save({ transaction: t });
                            //Enviar una transaccion para actualizar el numero de serie


                            await sequelize.query(
                                `UPDATE crm_invoice_serie SET used= used + 1 WHERE  id = :_serie_id`,
                                {
                                    replacements: {
                                        _serie_id: data.invoice_serie,
                                    },
                                    type: QueryTypes.UPDATE,
                                    transaction: t
                                }
                            );

                            return res.json({
                                status: 'success', invoice: invoice,
                            });

                            break;

                        default:
                            break;
                    }

                });

            } catch (error) {
                return res.json({
                    status: 'error', message: "Internal Server Error", error: error.message
                });
            }

        }
        return res.json({
            status: 'errorMessage', message: "Invoice not Found"
        });
    },


    invoice_get_data: async (req, res) => {
        let invoice = await Sale.findOne({
            where: {
                invoice_number: req.params.number,
                invoce_serie: req.params.serie,
            }, raw: true,
        });


        return invoice ?
            res.json({
                status: 'success', invoice
            })
            : res.json({
                status: 'error', message: "Invoice not Found"
            });

    },

    invoice_report_details: async (req, res) => {
        //obtener el rango de fechas y la sucursal
        let init = `${req.query.init} 00:00:00`;
        let end = `${req.query.end} 23:59:59`;
        //buscar la sucursal
        let sucursal = await Sucursal.findByPk(req.query.sucursal);
        let serie = req.query.serie;

        //buscar las facturas de esa sucursal, ordenadas por numero de la factura
        /*let invoices = await Sale.findAll({
            where: {
                invoice_number: {
                    [Op.not]: null
                },
                invoce_serie: serie,
                // sucursal: sucursal.id,
                invoice_date: {
                    [Op.between]: [init, end],
                },
            },
            order: [
                ['invoice_number', 'asc']
            ]
        });

        */


        let sql = "SELECT * FROM `crm_sale` WHERE invoice_number is not null and invoce_serie =  :_serie and invoice_date BETWEEN :init and :end order by invoice_number ASC";
        let invoices = await sequelize.query(sql, {
            replacements: {
                _serie: serie,
                init: init,
                end: end,
            },
            type: QueryTypes.SELECT,
            model: Sale,
        });

        return res.json({
            invoices, sucursal
        })
    },

    invoice_report_details2: async (req, res) => {
        //obtener el rango de fechas y la sucursal
        let init = `${req.query.init} 00:00:00`;
        let end = `${req.query.end} 23:59:59`;
        //buscar la sucursal
        let sucursal = await Sucursal.findByPk(req.query.sucursal);
        let serie = req.query.serie;

        let sql = "SELECT * FROM `crm_sale` WHERE invoice_number is not null and invoce_serie =  :_serie and invoice_date BETWEEN :init and :end order by invoice_number ASC";

        invoices = await sequelize.query(sql, {
            replacements: {
                _serie: serie,
                init: init,
                end: end,
            },
            type: QueryTypes.SELECT,
            model: Sale
        });

        
        sql = "select inventory_product.id, inventory_product.image, inventory_product.name, inventory_product.internal_code, inventory_product.classification as class, inventory_product.cost, inventory_product_classification.id as class_id, inventory_product_classification.name as class_name, inventory_product_classification._group from inventory_product INNER JOIN inventory_product_classification on inventory_product_classification.id = inventory_product.classification where inventory_product.id in (select product from crm_sale_detail where sale in(SELECT id FROM `crm_sale` WHERE invoice_number is not null and invoce_serie =  :_serie and invoice_date BETWEEN :init and :end))";
        
        let tmp = await sequelize.query(sql, {
            replacements: {
                _serie: serie,
                init: init,
                end: end,
            },
            type: QueryTypes.SELECT,
        });
        
        
        let products = {};
        tmp.forEach(element => products[element.id] = element);
        
        //buscar los detalles
        sql = 'select * from crm_sale_detail where sale in(SELECT id FROM `crm_sale` WHERE invoice_number is not null and invoce_serie =  :_serie and invoice_date BETWEEN :init and :end)'
        
        tmp = await sequelize.query(sql, {
            replacements: {
                _serie: serie,
                init: init,
                end: end,
            },
            type: QueryTypes.SELECT,
        });
        
        let details = {};
        tmp.forEach(element => {
            element.product = products[element.product];
            if(details[element.sale] == undefined || details[element.sale] == null){
                details[element.sale] = []
            }
            details[element.sale].push(element);
        });

        return res.json({
            invoices, sucursal, details
        })
    },

    invoices_payments: async (req, res) => {
        //obtener el rango de fechas y la sucursal
        let init = `${req.query.init} 00:00:00`;
        let end = `${req.query.end} 23:59:59`;
        //buscar la sucursal
        let sucursal = await Sucursal.findByPk(req.query.sucursal);
        let serie = req.query.serie;

        let sql = "SELECT * FROM `crm_sale` WHERE invoice_number is not null and invoce_serie =  :_serie and invoice_date BETWEEN :init and :end order by invoice_number ASC";

        let invoices = await sequelize.query(sql, {
            replacements: {
                _serie: serie,
                init: init,
                end: end,
            },
            type: QueryTypes.SELECT,
            model: Sale
        });

        let ids = [];
        invoices.forEach(sale => {
            if(sale.collected > 0.00){
                sale.payments.forEach(p => {
                    ids.push(p.id);
                })
            }
        });

        let payments = {};
        ids = await SalePayment.findAll({
            where: {
                id: {[Op.in]: ids}
            },
        });
        ids.forEach(id => payments[id.id] = id)
        return res.json({
            invoices, payments
        })
    },

    invoice_report: async (req, res) => {
        let sucursals = await Sucursal.findAll();
        let series = await InvoiceSeries.findAll({order:[['id', 'DESC'],]});
        return res.render('CRM/Invoice/invoiceReport.ejs', {
            sucursals,
            pageTitle: 'Reporte de facturas Generadas',
            series,
            types
        });
    },

    invoice_report2: async (req, res) => {
        let sucursals = await Sucursal.findAll();
        let series = await InvoiceSeries.findAll({order:[['id', 'DESC'],]});
        return res.render('CRM/Invoice/invoiceReportCost.ejs', {
            sucursals,
            pageTitle: 'Reporte de facturas Generadas',
            series,
            types
        });
    },


    corregir_la_fecha: async (req, res) => {
        let invoices = await Sale.findAll({
            where: {
                invoice_number: {
                    [Op.not]: null
                }
            }
        });

        let len = invoices.length;
        let salidas = '';
        for (let index = 0; index < len; index++) {
            let invoice = invoices[index];
            let fecha = invoice.invoice_data.invoice_date !== undefined ? invoice.invoice_data.invoice_date : invoice.createdAt;
            if (typeof fecha == 'string') {
                fecha = fecha.includes('T') ? fecha : `${fecha}T06:00:00`;
                fecha = new Date(fecha);
            }

            invoice.invoice_date = fecha;
            await invoice.save();
        }


        return res.send(salidas);
    },

    create_invoice: async (req, res) => {

        let data = req.body;
        let sale = await Sale.findByPk(data.sale);
        if (sale) {
            //buscar el numero de serie
            if (sale.invoice_number != null && sale.invoice_number !== "") {
                return res.json({ status: 'errorMessage', message: 'Esta Venta ya esta Facturada' });
            }

            //buscar la serie
            let serie = await InvoiceSeries.findByPk(data.invoice_serie);
            if (serie == null) {
                return res.json({ status: 'errorMessage', message: 'Seleccione el tipo de documento' });
            }

            //verificar si el numero del documento esta dentro del rango de la serie
            if (serie.init > data.invoice_number || data.invoice_number > serie.end) {
                return res.json({ status: 'errorMessage', message: `Este numero de Documento esta fuera del rango registrado, coloque un numero entre ${serie.init} y ${serie.end}` });
            }


            //buscar una venta que tenga el mismo numero de factura
            let existe = await Sale.count({
                where: {
                    invoce_serie: data.invoice_serie,
                    invoice_number: data.invoice_number,
                }
            });

            if (existe > 0) {
                return res.json({ status: 'errorMessage', message: 'Este numero de Documento ya esta registrado con la serie Seleccionada' });
            }

            data.invoice_data.last_update = req.session.userSession.shortName;
            data.invoice_data.createdBy = req.session.userSession.shortName;
            sale.invoice_resume = data.invoice_resume.length ? data.invoice_resume : null;
            sale.invoice_data = data.invoice_data;
            sale.invoice_retention = data.invoice_retention == true;
            sale.invoice_isr = data.invoice_isr == true;
            sale.invoce_serie = data.invoice_serie;
            sale.invoice_number = data.invoice_number;
            sale.invoice_type = serie.type;
            sale.invoice_date = new Date(data.invoice_data.invoice_date+"T06:00:00");

            //Token poner aca los taxes

            let sin_iva = Helper.fix_number(sale.balance / 1.13);
            sale.taxes = {
                iva: Helper.fix_number(sale.balance - sin_iva),
                retention: sale.invoice_retention && sin_iva > 100 ? Helper.fix_number(sin_iva * process.env.RETENTION) : 0.00,
                perception: 0.00,
                isr: sale.invoice_isr ? Helper.fix_number(sin_iva * process.env.RET_ISR) : 0.00,
            }

            if(data.invoice_data.giro !== ""){
                let client = await Client.findByPk(sale.client);
                if(client){
                    client.giro = data.invoice_data.giro;
                    client.save();
                }
            }


            try {
                return sequelize.transaction(async (t) => {
                    await sale.save({ transaccion: t });

                    let old_date = new Date(sale.invoice_date);
                    let now = new Date();
                    if (sale.invoice_number !== null && sale._status == "collected" && sale.in_report == true && old_date.getMonth() < now.getMonth()) {
                        await sequelize.query('update crm_sale set locked = 1 where id = :_id', {
                            replacements: {
                                _id: sale.id,
                            },
                            type: QueryTypes.UPDATE,
                            transaction: t
                        });
                    }

                    //Actualizar la serie
                    serie.used += 1;
                    await serie.save({ transaccion: t });



                    return res.json({
                        status: 'success',
                        message: "Actualizado con Exito",
                        sale: sale.id,
                    });
                });
            } catch (error) {
                return res.json({
                    status: 'error',
                    message: error.message,
                });
            }


        }
        return Helper.notFound(req, res, "Sale not Found or hasn't been invoced");
    },

    update_invoice: async (req, res) => {
        //buscar la venta
        let data = req.body;
        console.log(data);
        let sale = await Sale.findByPk(data.sale);
        if (sale) {

            try {
                return sequelize.transaction(async t => {
                    data.data.last_update = req.session.userSession.shortName;
                    sale.invoice_resume = data.invoice_resume.length ? data.invoice_resume : null;
                    sale.invoice_data = data.data;
                    sale.invoice_date = new Date(data.data.invoice_date);
                    sale.invoice_retention = data.invoice_retention == true;
                    sale.invoice_isr = data.invoice_isr == true;

                    //poner aca los taxes

                    let sin_iva = Helper.fix_number(sale.balance / 1.13);
                    sale.taxes = {
                        iva: Helper.fix_number(sale.balance - sin_iva),
                        retention: sale.invoice_retention && sin_iva > 100 ? Helper.fix_number(sin_iva * process.env.RETENTION) : 0.00,
                        perception: 0.00,
                        isr: sale.invoice_isr ? Helper.fix_number(sin_iva * process.env.RET_ISR) : 0.00,
                    }

                    await sale.save({ transaccion: t });

                    let old_date = new Date(sale.invoice_date);
                    let now = new Date();
                    if (sale.invoice_number !== null && sale._status == "collected" && sale.in_report == true && old_date.getMonth() < now.getMonth()) {
                        await sequelize.query('update crm_sale set locked = 1 where id = :_id', {
                            replacements: {
                                _id: sale.id,
                            },
                            type: QueryTypes.UPDATE,
                            transaction: t
                        });
                    }

                    return res.json({
                        status: 'success',
                        message: "Actualizado con Exito"
                    });
                });
            } catch (error) {
                return res.json({
                    status: 'error',
                    message: error.message,
                });
            }


        }

        return Helper.notFound(req, res, "Sale not Found or hasn't been invoced");
    },

    print_invoice_detail: async (req, res) => {
        //Buscar la venta
        let sale = await Sale.findByPk(req.params.id);

        if (sale && sale.invoice_number !== null) {
            //Buscar los detalles
            let details = await SaleDetail.findAll({
                where: {
                    sale: sale.id,
                },
                raw: true,
            });

            if (sale.delivery_amount !== null && sale.delivery_amount > 0.00) {
                details.push({
                    price: sale.delivery_amount,
                    description: 'Envio',
                    _order: details.length + 1,
                    cant: 1,
                    invoice_column: 'gravado',
                });
            }

            //buscar el cliente
            let cliente = await Client.findByPk(sale.client);

            //reolver los detalles de la factura

            let serie = await InvoiceSeries.findByPk(sale.invoce_serie);
            //enviar los datos a la vista
            let template = sale.invoice_type == "fcf" ? 'CRM/Invoice/print_detail_fcf' : 'CRM/Invoice/print_detail_ccf';

            return res.render(template, { sale, details, cliente, data: sale.invoice_data, serie });

        }
        return Helper.notFound(req, res,
            "Invoice not Found or the sale has'nt been invoced ");
    },

    print_invoice: async (req, res) => {
        //Buscar la venta
        let sale = await Sale.findByPk(req.params.id);



        if (sale && sale.invoice_number !== null) {
            if (sale._status == "revoked") {
                ref = `/sales/view_invoice/${sale.id}`;
                res.redirect(301, ref);
            }
            //Buscar los detalles
            let details = await SaleDetail.findAll({
                where: {
                    sale: sale.id,
                },
                raw: true,
            });

            if (sale.delivery_amount !== null && sale.delivery_amount > 0.00) {
                details.push({
                    price: sale.delivery_amount,
                    description: 'Envio',
                    _order: details.length + 1,
                    cant: 1,
                    invoice_column: 'gravado',
                });
            }

            //buscar el cliente
            let cliente = await Client.findByPk(sale.client);

            //reolver los detalles de la factura

            let serie = await InvoiceSeries.findByPk(sale.invoce_serie);
            //enviar los datos a la vista
            let template = sale.invoice_type == "fcf" ? 'CRM/Invoice/print-fcf' : 'CRM/Invoice/print-ccf';

            return res.render(template, { sale, details, cliente, data: sale.invoice_data, serie });

        }
        return Helper.notFound(req, res,
            "Invoice not Found or the sale has'nt been invoced ");
    },

    print_invoice2: async (req, res) => {
        //Buscar la venta
        let sale = await Sale.findByPk(req.params.id);

        if (sale && sale.invoice_number !== null && sale.invoice_type == "fcf" && sale.invoce_serie  == 10) {
            if (sale._status == "revoked") {
                ref = `/sales/view_invoice/${sale.id}`;
                res.redirect(301, ref);
            }
            //Buscar los detalles
            let details = await SaleDetail.findAll({
                where: {
                    sale: sale.id,
                },
                raw: true,
            });

            if (sale.delivery_amount !== null && sale.delivery_amount > 0.00) {
                details.push({
                    price: sale.delivery_amount,
                    description: 'Envio',
                    _order: details.length + 1,
                    cant: 1,
                    invoice_column: 'gravado',
                });
            }

            //buscar el cliente
            let cliente = await Client.findByPk(sale.client);

            //reolver los detalles de la factura
            let serie = await InvoiceSeries.findByPk(sale.invoce_serie);
            //enviar los datos a la vista

            return res.render('CRM/Invoice/print-fcf-provisional', { sale, details, cliente, data: sale.invoice_data, serie });

        }
        return Helper.notFound(req, res,
            "Invoice not Found or the sale has'nt been invoced ");
    },


    view_invoice: async (req, res) => {
        //Buscar la venta
        let sale = await Sale.findByPk(req.params.id);

        if (sale && sale.invoice_number !== null) {
            let cliente = await Client.findByPk(sale.client);
            //Buscar los detalles
            if(sale.invoice_type == "dte"){
                let dte = await DTE.findByPk(sale.invoice_number);

                console.log(dte)
                return res.render('CRM/Invoice/view-invoice-dte', { 
                    pageTitle: `DTE ${dte.codigo}`, 
                    dte: dte.dte,
                    helper_url: process.env.PDF_GENERATION_URL,
                    registro_id: dte.id
                });
            }


            let details = await SaleDetail.findAll({
                where: {
                    sale: sale.id,
                }, raw: true,
            });
            if (sale.delivery_amount !== null && sale.delivery_amount > 0.00) {
                details.push({
                    price: sale.delivery_amount,
                    description: 'Envio',
                    _order: details.length + 1,
                    cant: 1,
                    invoice_column: 'gravado',
                });
            }
            let serie = await InvoiceSeries.findByPk(sale.invoce_serie);
            let view = sale._status == "revoked" ? 'CRM/Invoice/view-revoked-invoice' : 'CRM/Invoice/view-invoice';
            return res.render(view, { pageTitle: `Ver Factura ${sale.invoice_type} N° ${sale.invoice_number}`, sale, details, cliente, data: sale.invoice_data, serie });

        }
        return Helper.notFound(req, res,
            "Invoice not Found or the sale has'nt been invoced ");
    },
};

module.exports = InvoiceController;