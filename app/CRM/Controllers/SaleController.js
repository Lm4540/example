const Sucursal = require('../../Inventory/Models/Sucursal');
const Client = require("../Models/Client");
const Sale = require('../Models/Sale');
const SaleDetail = require('../Models/SaleDetail');
const InvoiceSeries = require('../Models/InvoiceSerie');
const SalePayment = require('../Models/SalePayment');
const Product = require('../../Inventory/Models/Product');
const Stock = require('../../Inventory/Models/Stock');
const StockReserve = require('../../Inventory/Models/StockReserve');
const Movement = require("../../Inventory/Models/Movement");
const Provider = require("../../Inventory/Models/Provider");
const PettyCashMoves = require('../../Financial/Models/PettyCashMoves');
const Employee = require('../../HRM/Models/Employee');
const RequisitionDetail = require('../../Inventory/Models/RequisitionDetail');
const Requisition = require('../../Inventory/Models/Requisition');


const Helper = require('../../System/Helpers');
const sequelize = require("../../DataBase/DataBase");
const { Op, QueryTypes } = require("sequelize");
const path = require('path');
const fs = require('fs');

const Budget = require('../Models/Budget');
const BudgetDetail = require('../Models/BudgetDetail');
const Invoice = require('../Models/Invoice');
const InvoiceDetail = require('../Models/InvoiceDetail');

const Money = require('../../System/Money');
const { type } = require('os');


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




const relacionar_pago2 = async (pago) => {
    try {
        //buscar el pago
        let registered_payment = await SalePayment.findByPk(pago);
        //buscar el cliente
        let client = await Client.findByPk(registered_payment.client);
        // client.payments = (client.payments != null ? client.payments + registered_payment.amount : registered_payment.amount);

        return await sequelize.transaction(async (t) => {
            // await client.save({ transaction: t });

            let sales = await Sale.findAll({
                where: {
                    client: client.id,
                    _status: {
                        [Op.notIn]: ['process', 'collected', 'revoked'],
                    },
                    collected: sequelize.literal('collected < (balance + delivery_amount)')
                }
            });
            if (sales.length > 0) {


                let valor_restante = Helper.fix_number(registered_payment.amount - registered_payment.asigned_amount);
                let ids_registro = registered_payment.sales;
                let len = sales.length;

                for (let index = 0; index < len; index++) {
                    let sale = sales[index];
                    if (valor_restante > 0) {
                        let _collected = Number.parseFloat(sale.collected);
                        _collected = isNaN(_collected) ? 0.00 : _collected;
                        let sale_value = Helper.fix_number(Number.parseFloat(sale.balance) + Number.parseFloat(sale.delivery_amount) - _collected);
                        console.log('array de pagos', sale.payments);

                        let __sale_payments = sale.payments;
                        if (sale_value > valor_restante) {

                            sale.collected = (_collected + valor_restante);
                            __sale_payments.push({ "id": registered_payment.id, "amount": valor_restante })

                            if (sale.balance + sale.delivery_amount - sale.collected == 0) {
                                sale._status = sale._status == 'delivered' ? 'collected' : sale._status;
                            }

                            sale.payments = __sale_payments;
                            await sale.save({ transaction: t });
                            ids_registro.push({ "id": sale.id, "amount": valor_restante });
                            valor_restante = 0;
                        } else {
                            sale.collected = (_collected + sale_value);

                            __sale_payments.push({ "id": registered_payment.id, "amount": sale_value })

                            sale._status = sale._status == 'delivered' ? 'collected' : sale._status;
                            sale.payments = __sale_payments;
                            await sale.save({ transaction: t });
                            ids_registro.push({ "id": sale.id, "amount": sale_value });
                            valor_restante = Helper.fix_number(valor_restante - sale_value);
                        }
                    } else {
                        break;
                    }

                }

                registered_payment.sales = ids_registro;
                registered_payment.asigned_amount = Helper.fix_number(registered_payment.amount - valor_restante);
                await registered_payment.save({ transaction: t });
                return true;
            }

            return false;
        });



    } catch (error) {
        console.log(error);
        return false;
    }
};


const sale_status_verification = async (seller) => {
    //relacionar los pagos

    let payments = await sequelize.query('SELECT * FROM `crm_sale_payment` WHERE amount > asigned_amount', {
        type: QueryTypes.SELECT,
    });


    let len = payments.length;
    for (let index = 0; index < len; index++) {
        await relacionar_pago2(payments[index].id);
    }


    //verificar las ventas cuyo estado e entregado pero su costo es cero


    try {
        return await sequelize.transaction(async (t) => {
            let sales = await Sale.findAll({
                where: {
                    _status: 'delivered',
                    cost: 0.00
                }
            }, { transaction: t });
            for (let index = 0; index < sales.length; index++) {
                let sale = sales[index];
                let details = await SaleDetail.findAll({
                    where: {
                        sale: sale.id,
                    }
                }, { transaction: t });


                let suma = 0.00;
                for (let b = 0; b < details.length; b++) {
                    let detail = details[b];
                    let c = 0.00;
                    if (detail.product_cost < 0.01) {
                        //Buscar el costo del product_cost
                        let product = await Product.findByPk(detail.product, { transaction: t });
                        detail.product_cost = product.cost;
                        detail.save({ transaction: t });
                        c = product.cost;
                        //
                    } else {
                        c = detail.product_cost;
                    }
                    suma = Helper.fix_number(suma + (c * detail.cant));
                }
                sale.cost = suma;
                sale.save({ transaction: t });
            }


            //verificar el estado de las ventas
            sales = await Sale.findAll({
                where: {
                    // seller: seller,
                    in_report: 0,
                    revoked_at: { [Op.is]: null, },
                    _status: "delivered"
                }
            });

            len = sales.length;
            for (let index = 0; index < len; index++) {
                if (sales[index]._status !== 'collected') {
                    let saldo = Helper.fix_number(Helper.fix_number(sales[index].balance) + Helper.fix_number(sales[index].delivery_amount));
                    if (saldo == Helper.fix_number(sales[index].collected)) {
                        sales[index]._status = 'collected';
                        await sales[index].save({ transaction: t });
                    }
                }

            }

            return true;


        });
    } catch (error) {
        console.log(error.message);
        return false;
    }


}



const SaleController = {

    update_sale_delivery_type: async (req, res) => {
        //obtener los pedidos que esten abiertos


        let sales = await Sale.findAll({
            where: {
                _status: 'process',
                delivery_type: 'local',
            }
        });

        //recorrerlos y buscar la ultima compra realizada

        let largo = sales.length;
        let to_save = [];

        for (let index = 0; index < largo; index++) {
            let sale = sales[index];

            //buscar la ultima venta del mismo cliente 
            let last_sale = await Sale.findOne({
                where: {
                    client: sale.client,
                    id: {
                        [Op.lt]: sale.id,
                    }
                },
                order: [
                    ['id', 'DESC']
                ]
            });

            if (last_sale !== null) {
                if (last_sale.delivery_type !== sale.delivery_type) {
                    to_save.push(`UPDATE crm_sale SET delivery_type = '${last_sale.delivery_type}' WHERE id = ${sale.id}`);
                }
            }

        }
        console.log(to_save);

        if (to_save.length > 0) {
            try {
                return await sequelize.transaction(async (t) => {
                    for (let index = 0; index < to_save.length; index++) {
                        await sequelize.query(
                            to_save[index],
                            {
                                type: QueryTypes.UPDATE,
                                transaction: t
                            }
                        );

                    }
                    return res.json({ status: 'success', message: "guardado" });
                });

            } catch (error) {
                return res.json({
                    status: 'error',
                    message: error.message,
                });
            }
        }



    },

    update_prices: async (req, res) => {
        return res.render('CRM/Products/UpdatePrices', { pageTitle: 'Reporte de Ventas por Vendedor', limit: 10 });
    },

    update_price: async (req, res) => {
        let data = req.body;
        let product = await Product.findByPk(data.id);
        if (product) {
            let major = Helper.fix_number(data.major);
            let detail = Helper.fix_number(data.detail);
            if (isNaN(detail) || isNaN(major)) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Escriba valores numéricos válidos'
                });
            } else if (major > detail) {
                return res.json({
                    status: 'errorMessage',
                    message: 'El precio de detalle no puede ser más bajo que el precio de mayor'
                });
            } else {

                product.base_price = detail;
                product.major_price = major;

                await product.save();

                return res.json({
                    status: 'success', message: 'Producto Actualizado'
                });

            }
        }

        return res.json({
            status: 'errorMessage',
            message: 'Product Not Found!'
        });
    },

    sale_status_check: async (req, res) => {

        return res.json(sale_status_verification(1) ? {
            status: 'success',
            message: "Completado"
        } : {
            status: 'error',
            message: "Completado con errores"
        });
    },

    seller_history: async (req, res) => {
        let sucursals = await Sucursal.findAll({ raw: true });

        for (let index = 0; index < sucursals.length; index++) {
            sucursals[index].sellers = await Employee.findAll({
                where: {
                    isSeller: true,
                    sucursal: sucursals[index].id
                }
            });

        }
        return res.render('CRM/Sales/SellerReport', { pageTitle: 'Reporte de Ventas por Vendedor', sucursals });
    },

    //verificar estado de las ventas


    seller_history_details_comisioned: async (req, res) => {
        let date = req.body.date + ' 23:59:59';
        let seller = req.body.seller;
        let sales = await Sale.findAll({
            where: {
                seller: seller,
                in_report: 0,
                revoked_at: { [Op.is]: null, },
                endAt: { [Op.lte]: date },
                _status: 'collected',
                id: { [Op.lte]: req.body.sale },
            }
        });

        try {
            return await sequelize.transaction(async (t) => {
                for (let index = 0; index < sales.length; index++) {
                    let sale = sales[index];
                    sale.in_report = true;
                    await sale.save({ transaction: t });

                }
                return res.json({ status: 'success', message: "guardado" });
            });

        } catch (error) {
            return res.json({
                status: 'error',
                message: error.message,
            });
        }
    },

    seller_history_details: async (req, res) => {

        let seller = req.query.seller;
        let opt = req.query.opt;
        let date = req.query.date + ' 23:59:59';
        let init = req.query.init + ' 00:00:00';

        let where = {};

        if (opt == "sucursal") {
            where = {
                sucursal: seller,
                revoked_at: { [Op.is]: null, },
                endAt: { [Op.between]: [init, date], },
                _status: 'collected',
            }
        } else {
            //buscar el vendedor
            seller = await Employee.findByPk(seller);
            if (seller == null) {
                return res.json({
                    status: 'errorMessage', message: "Employee not Found!"
                });
            }

            await sale_status_verification(seller.id);

            where = opt == "calculo" ? {
                seller: seller.id,
                in_report: 0,
                revoked_at: { [Op.is]: null, },
                endAt: { [Op.lte]: date },
                _status: 'collected',
            } : {
                seller: seller.id,
                endAt: { [Op.between]: [init, date], },
                revoked_at: { [Op.is]: null, },
                _status: 'collected',
            }

        }


        let sales = await Sale.findAll({
            where: where
        });

        let tmp = await Sale.findAll({ where, attributes: ['client'], raw: true });
        let clients = [];

        tmp.forEach(client => clients.push(client.client));
        tmp = await Client.findAll({
            where: {
                id: {
                    [Op.in]: clients
                }
            }
        });
        clients = {};
        tmp.forEach(client => clients[client.id] = client);
        return res.json({ sales, clients });
    },


    revoke_invoice_view: async (req, res) => {

    },

    revoke_invoice: async (req, res) => {
        let sale = await Sale.findByPk(req.body.sale);
        let tmp = await SaleDetail.findAll({
            where: {
                sale: sale.id
            }
        });

        let dt = [];
        let subt = 0.00, exento = 0.00, no_sujeto = 0.00;
        tmp.forEach(ele => {
            let price = sale.invoice_type == "fcf" ? ele.price : Helper.fix_number(ele.price / 1.13);
            let subtt = 0.00;
            let ext = 0.00;
            let nosuje = 0.00;

            switch (ele.invoice_column) {
                case "gravadas":
                    subtt = Helper.fix_number(ele.cant * price)
                    break;

                case "gravadas":
                    ext = Helper.fix_number(ele.cant * price)
                    break;

                case "gravadas":
                    nosuje = Helper.fix_number(ele.cant * price)
                    break;

                default:
                    break;
            }

            subt = Helper.fix_number(subt + subtt);
            exento = Helper.fix_number(exento + ext);
            no_sujeto = Helper.fix_number(no_sujeto + nosuje);

            dt.push({
                id: ele.id,
                cant: ele.cant,
                price,
                no_sujetas: nosuje,
                exentas: ext,
                gravadas: subtt,
            });
        });

        let old_invoice = {
            invoice_number: sale.invoice_number,
            invoice_serie: sale.invoce_serie,
            invoice_date: sale.invoice_date,
            sale: sale.id,
            sucursal: sale.sucursal,
            type: sale.invoice_type,
            iva: subt * 0.13,
            subtotal: subt,
            retention: sale.invoice_retention ? Helper.fix_number(subt * 0.01) : 0.00,
            perception: 0.00,
            exento: exento,
            no_sujeto: no_sujeto,
            isr: sale.invoice_isr ? Helper.fix_number(subt * 0.1) : 0.00,
            revoked_at: new Date(),
            revoked_reason: req.body.reason,
            version: 1,
            details: dt,
            client: sale.client
        }
    },

    createPayment2: async (req, res) => {
        let data = req.body;
        let client = await Client.findByPk(data.client);
        if (client) {

            //verificar los datos
            if (data.method != 'money' && (data.bank.length < 4 || data.reference.length < 4)) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Proporcione el Nombre del Banco y el numero de referencia de la Transacción'
                });
            } else if (isNaN(data.amount) || data.amount < 0.01) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Monto no valido'
                });

            } else {
                let sucursal = await Sucursal.findByPk(data.sucursal);
                if (sucursal == null) {
                    return res.json({
                        status: 'errorMessage',
                        message: 'Sucursal no Encontrada'
                    });
                }

                let sale = await Sale.findByPk(data.sale);
                if (data.amount > Helper.fix_number(sale.balance + sale.delivery_amount - sale.collected)) {
                    return res.json({
                        status: 'errorMessage',
                        message: 'Monto Invalido'
                    });
                }

                try {
                    return await sequelize.transaction(async (t) => {
                        let registered_payment = null;

                        data.amount = Number.parseFloat(data.amount);

                        if (data.method == 'money') {
                            //generar el Ingreso a la caja Chica
                            let _move = await PettyCashMoves.create({
                                amount: data.amount,
                                last_amount: sucursal.balance,
                                concept: `Pago Recibido ${client.name} ID(${client.id}) ${sale.invoice_number !== "" && sale.invoice_number !== null ? sale.invoice_type.toUpperCase() + ' N° ' + sale.invoice_number : ''}`,
                                petty_cash: sucursal.id,
                                type: 'payment',
                                isin: true,
                                createdBy: req.session.userSession.shortName,
                                asigned_to: client.name,
                                _number: 0,
                            }, { transaction: t });

                            registered_payment = await SalePayment.create({
                                client: client.id,
                                sales: [],
                                type: 'money',
                                amount: data.amount,
                                asigned_amount: data.amount,
                                createdBy: req.session.userSession.shortName,
                            }, { transaction: t });

                            sucursal.balance = Helper.fix_number(sucursal.balance + data.amount);
                            await sucursal.save({ transaction: t });
                        } else {
                            registered_payment = await SalePayment.create({
                                client: client.id,
                                sales: [],
                                type: data.method,
                                amount: data.amount,
                                asigned_amount: data.amount,
                                bank: data.bank,
                                reference: data.reference,
                                createdBy: req.session.userSession.shortName,
                            }, { transaction: t });


                        }

                        client.payments = Helper.fix_number(client.payments + data.amount);
                        await client.save({ transaction: t });

                        //buscar la venta



                        let ids_registro = [];

                        sale.collected = Helper.fix_number(sale.collected + data.amount);

                        let _pays = sale.payments;

                        _pays.push({ "id": registered_payment.id, "amount": data.amount })
                        sale.payments = _pays;

                        if (sale.balance + sale.delivery_amount - sale.collected == 0) {
                            sale._status = sale._status == 'delivered' ? 'collected' : sale._status;
                        }

                        await sale.save({ transaction: t });

                        ids_registro.push({ "id": sale.id, "amount": data.amount });

                        registered_payment.sales = ids_registro;
                        registered_payment.asigned_amount = data.amount;
                        await registered_payment.save({ transaction: t });

                        return res.json({
                            status: 'success',
                            message: 'pago registrado',
                            data: registered_payment.id,
                        });
                    });

                } catch (error) {
                    console.log(error);
                    return res.json({
                        status: 'errorMessage',
                        message: error.message,
                    });
                }
            }

        }

        return Helper.notFound(req, res, 'Client not Found!')
    },

    createPayment: async (req, res) => {
        let data = req.body;
        let client = await Client.findByPk(data.client);
        if (client) {

            //verificar los datos
            if (data.method != 'money' && (data.bank.length < 4 || data.reference.length < 4)) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Proporcione el Nombre del Banco y el numero de referencia de la Transacción'
                });
            } else if (isNaN(data.amount) || data.amount < 0.01) {
                return res.json({
                    status: 'errorMessage',
                    message: 'Monto no valido'
                });

            } else {
                let sucursal = await Sucursal.findByPk(data.sucursal);
                if (sucursal == null) {
                    return res.json({
                        status: 'errorMessage',
                        message: 'Sucursal no Encontrada'
                    });
                }

                try {
                    return await sequelize.transaction(async (t) => {
                        let registered_payment = null;

                        data.amount = Number.parseFloat(data.amount);

                        if (data.method == 'money') {
                            //generar el Ingreso a la caja Chica
                            let _move = await PettyCashMoves.create({
                                amount: data.amount,
                                last_amount: sucursal.balance,
                                concept: `Pago Recibido Cliente ${client.name} `,
                                petty_cash: sucursal.id,
                                type: 'payment',
                                isin: true,
                                createdBy: req.session.userSession.shortName,
                                asigned_to: client.name,
                                _number: 0,
                            }, { transaction: t });

                            registered_payment = await SalePayment.create({
                                client: client.id,
                                sales: [],
                                type: 'money',
                                amount: data.amount,
                                asigned_amount: 0.00,
                                createdBy: req.session.userSession.shortName,
                            }, { transaction: t });

                            sucursal.balance += data.amount;
                            await sucursal.save({ transaction: t });
                        } else {
                            registered_payment = await SalePayment.create({
                                client: client.id,
                                sales: [],
                                type: data.method,
                                amount: data.amount,
                                asigned_amount: 0.00,
                                bank: data.bank,
                                reference: data.reference,
                                createdBy: req.session.userSession.shortName,
                            }, { transaction: t });


                        }

                        client.payments += registered_payment.amount;
                        await client.save({ transaction: t });

                        return res.json({
                            status: 'success',
                            message: 'pago registrado',
                            data: registered_payment.id,
                        });
                    });

                } catch (error) {
                    console.log(error);
                    return res.json({
                        status: 'errorMessage',
                        message: error.message,
                    });
                }
            }

        }

        return Helper.notFound(req, res, 'Client not Found!')
    },

    relacionar_pago: async (req, res) => {
        try {
            //buscar el pago
            let registered_payment = await SalePayment.findByPk(req.body.id);
            if (registered_payment.amount == registered_payment.asigned_amount) {
                return res.json({
                    status: 'success',
                    message: 'pago registrado',
                    data: registered_payment,
                });
            }

            //buscar el cliente
            let client = await Client.findByPk(registered_payment.client);
            // client.payments = (client.payments != null ? client.payments + registered_payment.amount : registered_payment.amount);

            return await sequelize.transaction(async (t) => {
                // await client.save({ transaction: t });

                let sales = await Sale.findAll({
                    where: {
                        client: client.id,
                        _status: {
                            [Op.notIn]: ['process', 'collected', 'revoked'],
                        },
                        collected: sequelize.literal('collected < (balance + delivery_amount)')
                    }
                });
                if (sales.length > 0) {


                    let valor_restante = registered_payment.amount;
                    let ids_registro = [];
                    let len = sales.length;

                    for (let index = 0; index < len; index++) {
                        let sale = sales[index];
                        if (valor_restante > 0) {
                            let _collected = Number.parseFloat(sale.collected);
                            _collected = isNaN(_collected) ? 0.00 : _collected;
                            let sale_value = (Number.parseFloat(sale.balance) + Number.parseFloat(sale.delivery_amount) - _collected);
                            console.log('array de pagos', sale.payments);


                            if (sale_value > valor_restante) {

                                sale.collected = (_collected + valor_restante);


                                let _pays = sale.payments;
                                _pays.push({ "id": registered_payment.id, "amount": valor_restante });
                                sale.payments = _pays;

                                if (sale.balance + sale.delivery_amount - sale.collected == 0) {
                                    sale._status = sale._status == 'delivered' ? 'collected' : sale._status;
                                }


                                await sale.save({ transaction: t });
                                ids_registro.push({ "id": sale.id, "amount": valor_restante });
                                valor_restante = 0;
                            } else {
                                sale.collected = (_collected + sale_value);

                                let _pays = sale.payments;
                                _pays.push({ "id": registered_payment.id, "amount": sale_value });
                                sale.payments = _pays;
                                sale._status = sale._status == 'delivered' ? 'collected' : sale._status;

                                await sale.save({ transaction: t });
                                ids_registro.push({ "id": sale.id, "amount": sale_value });
                                valor_restante -= sale_value;
                            }
                        } else {
                            break;
                        }

                    }

                    registered_payment.sales = ids_registro;
                    registered_payment.asigned_amount = registered_payment.amount - valor_restante;
                    await registered_payment.save({ transaction: t });



                    return res.json({
                        status: 'success',
                        message: 'pago registrado',
                        data: registered_payment,
                    });
                }

                return res.json({
                    status: 'error',
                    message: 'No hay Ventas que relacionar',
                    data: registered_payment,
                });
            });



        } catch (error) {
            console.log(error);
            return res.json({
                status: 'errorMessage',
                message: error.message,
            });
        }


        //buscar las compras del cliente que esten pendientes de pago



    },

    invoice_options: async (req, res) => {
        let tmp = await Sucursal.findAll();
        let sucursals = {};
        tmp.forEach(s => sucursals[s.id] = s.name);

        let types = {
            fcf: 'Factura de Consumidor Final',
            ccf: 'Comprobante de Credito Fiscal',
            fex: 'Factura de Exportacion',
            nr: 'Nota de Remision',
            nc: 'Nota de Crédito',
            nd: 'Nota de Debito',
        };

        tmp = await InvoiceSeries.findAll({
            where: {
                active: 1,
                sucursal: req.session.userSession.employee.sucursal,
            },
            order: [['id', 'DESC'],],
            raw: true
        });

        let series = {};
        tmp.forEach(serie => {
            let s = serie;
            s.sucursal_name = sucursals[serie.sucursal];
            s.number = serie.init + serie.used;
            s.type_name = types[s.type];
            series[s.id] = s;
        });

        return res.json(series);

    },

    invoice_serie: async (req, res) => {
        let sucursals = await Sucursal.findAll();
        let series = await InvoiceSeries.findAll({
            order: [['id', 'DESC'],]
        });
        let types = {
            fcf: 'Factura de Consumidor Final',
            ccf: 'Comprobante de Credito Fiscal',
            fex: 'Factura de Exportacion',
            nr: 'Nota de Remision',
            nc: 'Nota de Crédito',
            nd: 'Nota de Debito',
        };


        return res.render('CRM/Sales/invoiceSeries', { pageTitle: 'Numeros de Serie', sucursals, series, types });
    },


    save_invoice_serie: async (req, res) => {
        let data = req.body;

        if (data.serieName.length < 4) {
            return res.json({
                status: 'errorMessage',
                message: "Coloque el numero de Serie"
            })
        } else if (isNaN(data.desde) || data.desde < 1) {
            return res.json({
                status: 'errorMessage',
                message: 'Proporcione el numero de inicio de la serie'
            })

        } else if (isNaN(data.hasta) || data.hasta < 1 || data.hasta < data.desde) {
            return res.json({
                status: 'errorMessage',
                message: 'Proporcione el numero de final de la serie'
            })
        }

        //buscar a ver si ya existe la serie
        let serie = await InvoiceSeries.findAll({
            where: {
                serie: data.serieName
            }
        });


        if (serie.length > 0) {
            return res.json({
                status: 'errorMessage',
                message: 'Esta serie ya esta registrada'
            })
        }

        serie = await InvoiceSeries.create({
            init: data.desde,
            end: data.hasta,
            serie: data.serieName,
            type: data.type,
            used: 0,
            active: true,
            sucursal: data.sucursal
        });


        return res.json({
            status: 'success',
            message: 'Guardado con Exito'
        })
    },

    update_invoice_serie: async (req, res) => {
        let data = req.body;

        if (data.serieName.length < 4) {
            return res.json({
                status: 'errorMessage',
                message: "Coloque el numero de Serie"
            })
        } else if (isNaN(data.desde) || data.desde < 1) {
            return res.json({
                status: 'errorMessage',
                message: 'Proporcione el numero de inicio de la serie'
            })

        } else if (isNaN(data.hasta) || data.hasta < 1 || data.hasta < data.desde) {
            return res.json({
                status: 'errorMessage',
                message: 'Proporcione el numero de final de la serie'
            })
        }

        serie = await InvoiceSeries.findByPk(data.serie_id);
        if (serie !== null) {

            serie.init = data.desde;
            serie.end = data.hasta;
            serie.sucursal = data.sucursal;
            await serie.save();
            return res.json({
                status: 'success',
                message: 'Guardado con Exito'
            })
        }

        return res.json({
            status: 'errorMessage',
            message: 'Serie no encontrada'
        })


    },

    history: async (req, res) => {
        const sucursals = await Sucursal.findAll();
        return res.render('CRM/Sales/history', { pageTitle: 'Historial de ventas', sucursals });
    },
    historyData: async (req, res) => {
        let init = req.query.init;
        let end = req.query.end;
        let sucursal = req.query.sucursal;

        //buscar las compras
        //


    },

    inProccess: async (req, res) => {

        let _options = [
            { id: 'process', name: 'En Proceso' },
            { id: 'prepared', name: "Paquete Preparado" },
            { id: 'transport', name: "En Ruta" },
            { id: 'delivered', name: 'Entregado' },
            { id: 'to_resend', name: "Marcado para reenvio" },
            { id: 'closed', name: 'Cerrado' },
        ];
        let seller = req.query.seller !== undefined && req.query.seller !== "all" ? req.query.seller : null;
        let _status = req.query._status !== undefined && req.query._status !== "all" ? req.query._status : null;

        let where = {
            _status: {
                [Op.notIn]: ['collected', 'revoked'],
            }
        };

        if (_status) {
            if (seller) {
                where = {
                    _status: _status,
                    seller: seller
                };
            } else {
                where = {
                    _status: _status,
                };
            }
        } else if (seller) {
            where = {
                seller: seller,
                _status: {
                    [Op.notIn]: ['collected', 'revoked'],
                }
            };
        }

        let limit_date = new Date();
        limit_date.setDate(limit_date.getDate() - 7);
        //Buscar las ventas que no esten finalizadas
        let sales = await Sale.findAll({
            where: where
        });


        //buscar los clientes
        let tmp = await Client.findAll({
            where: {
                id: { [Op.in]: sequelize.literal('(SELECT client FROM `crm_sale` WHERE _status not in ("revoked", "collected"))') }
            }
        });
        let clients = {};
        tmp.forEach(e => clients[e.id] = e.name);
        //los vendedores

        let employees = await Employee.findAll({
            where: { isSeller: true },
            order: [
                ['name', 'ASC'],
            ]
        });
        let sellers = {};

        employees.forEach(e => {
            let name = e.name.split(' ');
            sellers[e.id] = name.length == 4 ? `${name[0]} ${name[2]}` : e.name;
        });

        tmp = await Sucursal.findAll();
        let sucursals = {};
        tmp.forEach(el => sucursals[el.id] = el.abreviation);

        //pasar los datos
        return res.render('CRM/Sales/inProccess', { pageTitle: 'Venta en Sala', sucursals, sellers, clients, sales, status, limit_date, employees, _options });
    },

    addDetail: async (req, res) => {
        let data = req.body;
        if (data.cant < 1) {
            return res.json({ status: 'errorMessage', message: 'Agrega una cantidad' });
        } else if (data.price < 0 || data.price == "") {
            return res.json({ status: 'errorMessage', message: 'El precio no es valido' });
        } else if (data.client < 1 || data.client == "") {
            return res.json({ status: 'errorMessage', message: 'Cliente no seleccionado' });
        }

        //buscar el cliente
        let client = await Client.findByPk(data.client).catch(err => next(err));
        if (client == null) {
            return res.json({ status: 'errorMessage', message: 'Cliente no seleccionado' });
        }



        try {
            data.cant = Number.parseInt(data.cant);
            data.price = Number.parseFloat(data.price);

            const result = await sequelize.transaction(async (t) => {
                let sale = null, detail_count = 0;

                if (data.sale == "" || data.sale == null) {
                    let last_sale = await Sale.findOne({
                        where: {
                            client: client.id
                        },
                        order: [
                            ['id', 'DESC']
                        ]
                    });

                    console.log('ESTA ES LA INFORMACION DE LA ULTIMA COMPRA', last_sale);


                    sale = await Sale.create({
                        client: client.id,
                        seller: req.session.userSession.employee.id,
                        sucursal: req.session.userSession.employee.sucursal,
                        credit_conditions: 0,
                        _status: 'process',
                        type: client.type,
                        delivery_type: last_sale !== null ? last_sale.delivery_type : 'local',
                        balance: 0.00
                    }, { transaction: t });
                } else {
                    sale = await Sale.findByPk(data.sale);
                    detail_count = await SaleDetail.count({ where: { sale: sale.id } });
                }

                let detail = {
                    sale: sale.id,
                    product: null,
                    price: data.price,
                    description: null,
                    image: null,
                    _order: detail_count,
                    cant: data.cant,
                    ready: 0,
                    delivered: 0,
                    reserved: 0
                };

                sale.balance = Number.parseFloat(sale.balance) + (data.cant * data.price);
                await sale.save({ transaction: t });
                let existe = null;
                if (data.case == 'inventory') {
                    //buscar el productoo
                    let product = await Product.findByPk(data.product);
                    if (product == null) {
                        t.rollback();
                        return res.json({ status: 'errorMessage', message: 'Producto no encontrado' });
                    }
                    //buscar a ver si ya hay un detalle existente
                    existe = await SaleDetail.findOne({
                        where: {
                            [Op.and]: {
                                sale: sale.id,
                                product: product.id,
                                price: data.price
                            }
                        }
                    });

                    if (existe !== null) {
                        existe.cant += data.cant;
                        await existe.save({ transaction: t })
                    } else {
                        detail.description = product.name;
                        detail.product = product.id;
                        detail.image = product.raw_image_name;
                    }

                } else {
                    detail.description = data.description;

                    let image_name = null;
                    if (data.image.length > 1) {
                        image_name = 'sd_temp_' + Helper.generateNameForUploadedFile() + '.jpg';
                        let location = path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images', image_name);
                        let image_data = data.image.slice(23);
                        fs.writeFile(location, image_data, 'base64', (err) => { if (err) { console.log(err) } });
                    }
                    detail.image = image_name;
                }

                //buscar ah ver si existe un detalle anterior
                detail = existe !== null ? existe : await SaleDetail.create(detail, { transaction: t });

                if (data.case == 'inventory') {
                    //buscar los stock e indexarlos
                    let tmp = await sequelize.query('SELECT * FROM `inventory_product_stock` WHERE product = :id and cant > reserved;', {
                        replacements: { id: data.product, },
                        type: QueryTypes.SELECT,
                        model: Stock,
                    });

                    var stocks = [],
                        stock = null;
                    if (tmp.length > 0) {
                        tmp.forEach(element => {
                            if (element.sucursal == sale.sucursal) {
                                stock = element;
                            } else {
                                stocks.push(element);
                            }
                        });
                    } else {
                        t.rollback();
                        return res.json({ status: 'errorMessage', message: 'Existencias no econtradas' });
                    }


                    var faltante = data.cant;
                    //buscar el stock de la sucursal de la venta
                    if (stock != null) {
                        let disponible = stock.cant - stock.reserved;
                        if (disponible > faltante) {
                            stock.reserved += faltante;
                            await stock.save({ transaction: t });

                            //buscar una reserva que coincida con el producto, sucursal e id del detalle
                            let reserve = await StockReserve.findOne({
                                where: {
                                    [Op.and]: {
                                        type: 'sale',
                                        saleId: detail.id,
                                        product: stock.product,
                                        sucursal: stock.sucursal,
                                    }
                                }
                            });

                            if (reserve !== null) {
                                reserve.cant += faltante;
                                await reserve.save({ transaction: t });
                            } else {
                                //Si no existe, crearlo
                                reserve = await StockReserve.create({
                                    cant: faltante,
                                    createdBy: req.session.userSession.shortName,
                                    concept: 'reserva por venta',
                                    type: 'sale',
                                    saleId: detail.id,
                                    product: stock.product,
                                    sucursal: stock.sucursal,
                                }, { transaction: t });
                            }

                            faltante = 0;
                        } else {
                            stock.reserved += disponible;
                            await stock.save({ transaction: t });

                            //registrar la reserva
                            //buscar una reserva que coincida con el producto, sucursal e id del detalle
                            let reserve = await StockReserve.findOne({
                                where: {
                                    [Op.and]: {
                                        type: 'sale',
                                        saleId: detail.id,
                                        product: stock.product,
                                        sucursal: stock.sucursal,
                                    }
                                }
                            });

                            if (reserve !== null) {
                                reserve.cant += disponible;
                                await reserve.save({ transaction: t });
                            } else {
                                reserve = await StockReserve.create({
                                    cant: disponible,
                                    createdBy: req.session.userSession.shortName,
                                    concept: 'reserva por venta',
                                    type: 'sale',
                                    saleId: detail.id,
                                    product: stock.product,
                                    sucursal: stock.sucursal,
                                }, { transaction: t });
                            }
                            faltante -= disponible;
                        }
                    }

                    if (faltante > 0) {
                        for (let index = 0; index < stocks.length; index++) {
                            const stock = stocks[index];
                            if (faltante > 0) {
                                let disponible = stock.cant - stock.reserved;
                                if (disponible > faltante) {
                                    stock.reserved += faltante;
                                    await stock.save({ transaction: t });

                                    //buscar una reserva que coincida con el producto, sucursal e id del detalle
                                    let reserve = await StockReserve.findOne({
                                        where: {
                                            [Op.and]: {
                                                type: 'sale',
                                                saleId: detail.id,
                                                product: stock.product,
                                                sucursal: stock.sucursal,
                                            }
                                        }
                                    });

                                    if (reserve !== null) {
                                        reserve.cant += faltante;
                                        await reserve.save({ transaction: t });
                                    } else {
                                        //registrar la reserva
                                        reserve = await StockReserve.create({
                                            cant: faltante,
                                            createdBy: req.session.userSession.shortName,
                                            concept: 'reserva por venta',
                                            type: 'sale',
                                            saleId: detail.id,
                                        }, { transaction: t });
                                    }
                                    faltante = 0;
                                } else {
                                    stock.reserved += disponible;
                                    await stock.save({ transaction: t });

                                    //buscar una reserva que coincida con el producto, sucursal e id del detalle
                                    let reserve = await StockReserve.findOne({
                                        where: {
                                            [Op.and]: {
                                                type: 'sale',
                                                saleId: detail.id,
                                                product: stock.product,
                                                sucursal: stock.sucursal,
                                            }
                                        }
                                    });

                                    if (reserve !== null) {
                                        reserve.cant += disponible;
                                        await reserve.save({ transaction: t });
                                    } else {
                                        reserve = await StockReserve.create({
                                            cant: disponible,
                                            createdBy: req.session.userSession.shortName,
                                            concept: 'reserva por venta',
                                            type: 'sale',
                                            saleId: detail.id,
                                        }, { transaction: t });
                                    }
                                    faltante -= disponible;
                                }
                            }
                        }
                    }

                    detail.reserved += data.cant - faltante;
                    await detail.save({ transaction: t });
                }

                return res.json({ status: 'success', message: 'Guardado', data: { detail, balance: sale.balance } });
                //throw new Error();

            });
        } catch (error) {
            console.error(error);
        }
    },

    updateSaleDetail: async (req, res) => {
        let data = req.body;

        //obtener el detalle
        let detail = await SaleDetail.findByPk(data.detail_id).catch(err => next(err));

        if (detail) {
            let sale = await Sale.findByPk(detail.sale).catch(err => next(err));
            if (sale) {
                try {
                    let count = await SaleDetail.count({ where: { sale: sale.id } }) - 1;
                    const result = await sequelize.transaction(async (t) => {

                        let old_amount = Number.parseInt(detail.cant) * Number.parseFloat(detail.price);
                        data.price = data.price !== undefined ? Number.parseFloat(data.price) : 0;
                        data.cant = Number.parseInt(data.cant > detail.cant ? detail.cant : data.cant);

                        switch (data.case) {
                            case 'delete':
                                if (detail.product == null || detail.reserved == 0) {
                                    if (data.cant == detail.cant) {
                                        //actualizar el monto de la venta
                                        sale.balance = Number.parseFloat(sale.balance) - old_amount;
                                        //detruir el detalle
                                        let location = path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images', detail.img);
                                        await detail.destroy({ transaction: t });
                                        detail = null;
                                        //eliminar la imagen temporal
                                        fs.unlink(location, (err) => { if (err) { console.log(err); } else { console.log('image deleted'); } });
                                    } else {
                                        // reducir el detalle
                                        detail.cant -= data.cant;
                                        await detail.save();
                                        sale.balance = Number.parseFloat(sale.balance) - old_amount + (Number.parseInt(detail.cant) * Number.parseFloat(detail.price));
                                    }
                                } else {
                                    //buscar las reservas que esten relacionadas con el stock del producto
                                    let reserves = await StockReserve.findAll({
                                        where: {
                                            [Op.and]: {
                                                saleId: detail.id,
                                                product: detail.product
                                            }
                                        },
                                        order: [['id', 'DESC']]
                                        //por la creacion se tiene como prioridad la sucursal del empleado que registra, para la eliminacion se tendra como prioridad las otras sucursales
                                    });
                                    //buscar los stock que esten relacionados con el producto, se puede optimizar
                                    let tmp = await Stock.findAll({ where: { product: detail.product }, order: [['id', 'DESC']] });
                                    let stocks = {};
                                    tmp.forEach(element => stocks[element.sucursal] = element);
                                    //Si hay producto revisado no se puede eliminar por tanto cambiaremos el valor maximo para tomar el valor de lo que no esta revisado
                                    if (detail.ready > 0) {
                                        //significa que hay parte ya revisada, la cual no se puede quitar asi por asi
                                        let revertible = detail.cant - detail.ready;
                                        if (data.cant > revertible) {
                                            let sol = data.cant - revertible;
                                            data.cant = revertible;
                                            //realizar solicitud de reversion si se quiere hacer en automatico
                                        }

                                    }
                                    if (data.cant > 0) {
                                        //si la cantidad es igual a la cantidad del detalle vamos a eliminarlo
                                        if (data.cant == detail.cant) {
                                            //buscar las reservas y destruirlas
                                            for (let index = 0; index < reserves.length; index++) {
                                                let reserve = reserves[index];
                                                let stock = stocks[reserve.sucursal];

                                                stock.reserved -= reserve.cant;
                                                await stock.save({ transaction: t });
                                                await reserve.destroy({ transaction: t });
                                            }

                                            await detail.destroy({ transaction: t });
                                            detail = null;
                                            sale.balance = Number.parseFloat(sale.balance) - old_amount;
                                        } else {

                                            //si no a reducirlo
                                            let faltante = data.cant;

                                            for (let index = 0; index < reserves.length; index++) {
                                                if (faltante > 0) {
                                                    let reserve = reserves[index];
                                                    let stock = stocks[reserve.sucursal];

                                                    if (faltante > reserve.cant) {
                                                        //destruir la reserva
                                                        stock.reserved -= reserve.cant;
                                                        await stock.save({ transaction: t });
                                                        await reserve.destroy({ transaction: t });
                                                    } else {
                                                        //reducir la reserva
                                                        reserve.cant -= faltante;
                                                        stock.reserved -= faltante;
                                                        await stock.save({ transaction: t });
                                                        await reserve.save({ transaction: t });
                                                    }
                                                }
                                            }
                                            detail.cant -= data.cant;
                                            detail.reserved -= data.cant;
                                            await detail.save({ transaction: t });
                                            sale.balance = Number.parseFloat(sale.balance) - old_amount + (Number.parseInt(detail.cant) * Number.parseFloat(detail.price));
                                        }
                                    }
                                }



                                if (count < 1 && detail == null) {
                                    await sale.destroy({ transaction: t });
                                    sale = null;
                                } else {
                                    sale = await sale.save({ transaction: t });
                                }
                                return res.json({ status: 'success', message: 'Guardado', detail, balance: sale !== null ? sale.balance : null });

                                break;
                            case 'price':
                                //Restar el monto de la cuenta de la venta
                                let new_amount = data.price * detail.cant;
                                detail.price = data.price;
                                sale.balance = sale.balance - old_amount + new_amount;
                                await detail.save({ transaction: t });
                                await sale.save({ transaction: t });
                                return res.json({ status: 'success', message: 'Guardado', detail, balance: sale.balance });
                                //enviar la respuesta con el nuevo balance y el nuevo objeto detalle
                                break;
                            case 'realese request':
                                //crear el realease request
                                let release_request = null;


                                return res.json({ status: 'success', message: 'Guardado', release_request });
                                break;
                            default:
                                break;
                        }


                    });
                } catch (error) {
                    console.error(error);
                }
            } else {
                return res.json({ status: 'errorMessage', message: 'Venta o Pedido no encontrado' });

            }
        } else {
            return res.json({ status: 'errorMessage', message: 'Detalle no encontrado' });
        }
    },

    createClientSale: async (req, res) => {
        let cliente = await Client.findByPk(req.params.id);
        let providers = await Provider.findAll({ where: { type: 'transport' } });
        let locations = {};
        providers.forEach(prov => {
            if (prov.delivery_locations !== null) {
                locations[prov.id] = prov.delivery_locations;
            }
        });

        return cliente !== null
            ? res.render('CRM/Sales/clientNewSale', {
                pageTitle: 'Registrar Venta',
                cliente,
                UserSucursal: req.session.userSession.employee.sucursal,
                providers,
                locations
            })
            : Helper.notFound(req, res, 'Client not Found');
    },

    saveNewSale: async (req, res) => {
        //obtener la data

        //Crear la venta


        //crear los detalles con la reserva

        //enviar la respuesta

        //emitir un nuevo evento para la parte de 
    },

    saleInRoomView: async (req, res) => {
        let sucursal = await Sucursal.findByPk(req.session.userSession.employee.sucursal);
        return res.render('CRM/Sales/NewSaleInRoom', { pageTitle: 'Venta en Sala', sucursal });
    },

    viewSaleCost: async (req, res) => {
        //buscar la venta
        let sale = await Sale.findByPk(req.params.id)
        if (sale) {

            //buscar el Cliente
            let cliente = await Client.findByPk(sale.client);

            if (cliente) {
                //Buscar el empleado
                let seller = await Employee.findByPk(sale.seller);
                if (seller) {
                    let sucursal = await Sucursal.findByPk(seller.sucursal);
                    //buscar los detalles
                    let details = await SaleDetail.findAll({
                        where: {
                            sale: sale.id
                        }
                    });

                    return res.render('CRM/Sales/view_sale_cost_details', { pageTitle: 'Venta ID:' + sale.id, sucursal, sale, details, seller, cliente, status });
                }

            }

        }

        return Helper.notFound(req.res, 'Invoice or Sale not Found!');

    },

    viewPayments: async (req, res) => {
        //buscar la venta
        let sale = await Sale.findByPk(req.params.id)
        if (sale) {

            //buscar el Cliente
            let cliente = await Client.findByPk(sale.client);

            if (cliente) {
                //Buscar el empleado
                let seller = await Employee.findByPk(sale.seller);
                if (seller) {
                    let sucursal = await Sucursal.findByPk(seller.sucursal);
                    //buscar los pagos

                    let pays = [];
                    let ids = []
                    sale.payments.forEach(p => {
                        pays[p.id] = p.amount;
                        ids.push(p.id);
                    });


                    ids = await SalePayment.findAll({
                        where: {
                            id: { [Op.in]: ids }
                        }
                    });

                    let payments = [];

                    ids.forEach(id => {
                        payments.push({
                            amount: pays[id.id],
                            type: id.type,
                            total_amount: id.amount,
                            bank: id.bank,
                            reference: id.reference,
                            createdAt: id.createdAt,
                            createdBy: id.createdBy,
                        });
                    });

                    let serie = null;
                    if (sale.invoice_number != null && sale.invoice_number != '' && sale.invoice_number > 0) {
                        serie = await InvoiceSeries.findByPk(sale.invoce_serie);
                    }
                    //buscar los detalles
                    return res.render('CRM/Sales/viewPayments', { pageTitle: 'Venta ID:' + sale.id, sucursal, sale, seller, cliente, status, payments, serie });
                }
            }
        }

        return Helper.notFound(req.res, 'Invoice or Sale not Found!');
    },

    viewSale: async (req, res) => {
        //buscar la venta
        let sale = await Sale.findByPk(req.params.id)
        if (sale) {

            //buscar el Cliente
            let cliente = await Client.findByPk(sale.client);

            if (cliente) {
                //Buscar el empleado
                let seller = await Employee.findByPk(sale.seller);
                if (seller) {
                    let sucursal = await Sucursal.findByPk(seller.sucursal);
                    //buscar los detalles
                    let details = await SaleDetail.findAll({
                        where: {
                            sale: sale.id
                        }
                    });
                    return res.render('CRM/Sales/view_sale', { pageTitle: 'Venta ID:' + sale.id, sucursal, sale, details, seller, cliente, status });
                }
            }
        }
    },

    quit_detail_revised: async (req, res) => {

        //Buscar el detalle
        let detail = await SaleDetail.findByPk(req.body.detail_id);

        if (detail) {
            //Buscar la venta
            let sale = await Sale.findByPk(detail.sale).catch(err => next(err));
            if (sale) {


                if (sale._status != 'process') {
                    return res.json({
                        status: 'errorMessage', message: 'Ya no se puede modificar esta venta',
                    });
                }
                try {
                    //contar si la venta tiene mas detalles
                    let count = await SaleDetail.count({ where: { sale: sale.id } });

                    return await sequelize.transaction(async (t) => {
                        sale.balance -= Helper.fix_number(Number.parseInt(detail.cant) * Number.parseFloat(detail.price))

                        //Buscar el producto, el Stock y la reserva
                        let product = await Product.findByPk(detail.product);
                        let reserves = await StockReserve.findAll({
                            where: {
                                [Op.and]: {
                                    saleId: detail.id,
                                    product: detail.product
                                }
                            },
                            order: [['id', 'DESC']]
                            //por la creacion se tiene como prioridad la sucursal del empleado que registra, para la eliminacion se tendra como prioridad las otras sucursales
                        });



                        for (let index = 0; index < reserves.length; index++) {
                            //Buscar el Stock

                            let stock = await Stock.findOne({
                                where: {
                                    product: reserves[index].product,
                                    sucursal: reserves[index].sucursal,
                                }
                            });


                            stock.reserved -= reserves[index].cant;
                            product.reserved -= reserves[index].cant;

                            await product.save({ transaction: t });
                            await stock.save({ transaction: t });
                            await reserves[index].destroy({ transaction: t });
                        }

                        await detail.destroy({ transaction: t });




                        if (count < 2) {
                            await sale.destroy({ transaction: t });
                        } else {
                            sale = await sale.save({ transaction: t });
                        }

                        return res.json({
                            status: 'success', message: 'Guardado',
                        });
                        // return { status: 'success', message: 'Guardado', detail, balance: sale !== null ? sale.balance : null, sale_id: _sale_id };

                    });
                } catch (error) {
                    console.error(error);
                    return res.json({
                        status: 'errorMessage', message: 'Venta o Pedido no encontrado', data: error.message
                    });

                }
            } else {
                return res.json({
                    status: 'errorMessage', message: 'Venta o Pedido no encontrado'
                });

            }
        } else {
            return res.json({
                status: 'errorMessage', message: 'Detalle no encontrado'
            });
        }
    },

    add_detail_from_request_tranfer: async (req, res) => {
        let data = req.body;
        let session = req.session.userSession;

        if (session.employee.sucursal == data.sucursal) {
            return res.json({ status: 'errorMessage', message: 'La sucursal origen del traslado no puede ser el mismo sitio de el lugar asignado al vendedor' });
        } else if (data.cant < 1) {
            return res.json({ status: 'errorMessage', message: 'Agrega una cantidad' });
        } else if (data.price < 0 || data.price == "") {
            return res.json({ status: 'errorMessage', message: 'El precio no es valido' });
        } else if (data.client < 1 || data.client == "") {
            return res.json({ status: 'errorMessage', message: 'Cliente no seleccionado' });
        }

        //buscar el cliente
        let client = await Client.findByPk(data.client);
        if (client == null) { return res.json({ status: 'errorMessage', message: 'Cliente no seleccionado' }); }
        if (client.seller !== session.employee.id && !session.permission.includes('update_sales_of_another_user')) { return res.json({ status: 'errorMessage', message: 'No tienes permiso para agregar productos a este cliente' }); }

        try {
            data.cant = Number.parseInt(data.cant);
            data.price = Number.parseFloat(data.price);

            let sale = await Sale.findOne({
                where: {
                    [Op.and]: {
                        client: data.client,
                        _status: 'process'
                    }
                }
            });

            let product = await Product.findByPk(data.product);
            if (product == null) { throw 'Producto no encontrado'; }

            let detail_count = 0;
            let detail = null;
            if (sale !== null && sale !== undefined) {
                if (sale.sucursal !== session.employee.sucursal) { throw 'No puedes agregar productos a una venta de otra sucursal'; }
                detail_count = await SaleDetail.count({ where: { sale: sale.id } });
            }

            //buscar el stock que pertenece a la sucursal seleccionada
            var stock = await Stock.findOne({
                where: {
                    product: data.product,
                    sucursal: data.sucursal
                }
            });


            if (stock == null || stock == undefined || (stock.cant - stock.reserved < data.cant)) { throw 'No hay suficientes ecistencias en tu sucursal asignada para poder agregar este producto'; }

            //buscar a ver si ya hay un detalle existente
            if (detail_count > 0) {
                detail = await SaleDetail.findOne({
                    where: {
                        [Op.and]: {
                            sale: sale.id,
                            product: data.product,
                            price: data.price
                        }
                    }
                });
            }

            //buscar la requisicion
            let requisition = await Requisition.findOne({
                where: {
                    origin: data.sucursal,
                    destino: session.employee.sucursal,
                    _status: 'open'
                }
            })

            return await sequelize.transaction(async (t) => {

                var createdBy = session.employee.name;
                let userid = session.employee.id;

                //Agregar aca el tipo de envio

                if (sale == null) {

                    let last_sale = await Sale.findOne({
                        where: {
                            client: client.id,

                        },
                        order: [
                            ['id', 'desc']
                        ]
                    });

                    sale = await Sale.create({
                        client: client.id,
                        seller: session.employee.id,
                        sucursal: session.employee.sucursal,
                        credit_conditions: 0,
                        _status: 'process',
                        type: client.type,
                        balance: 0.00,
                        delivery_type: last_sale !== null ? last_sale.delivery_type : 'delivery'
                    }, { transaction: t });
                }

                sale.balance = sale.balance + Helper.fix_number(data.cant * data.price);
                await sale.save({ transaction: t });

                if (detail !== null) {
                    detail.cant = detail.cant + data.cant;
                    await detail.save({ transaction: t });
                } else {
                    detail = await SaleDetail.create({
                        sale: sale.id,
                        product: product.id,
                        price: data.price,
                        description: product.name + ' SKU ' + product.sku,
                        image: product.raw_image_name,
                        _order: detail_count,
                        cant: data.cant,
                        ready: 0,
                        delivered: 0,
                        reserved: 0
                    }, { transaction: t });
                }

                if (requisition == null) {
                    requisition = await Requisition.create({
                        origin: data.sucursal,
                        destino: session.employee.sucursal,
                        _status: 'open',
                        createdBy,
                    }, { transaction: t });

                    let req_detail = await RequisitionDetail.create({
                        requisition: requisition.id,
                        product: product.id,
                        client: data.client,
                        cant: data.cant,
                        createdBy,
                        client_name: client.name,
                        user: userid,
                        sale_detail: detail.id
                    }, { transaction: t });

                    let reserve = await StockReserve.create({
                        cant: data.cant,
                        createdBy,
                        concept: 'Reserva por Solicitudes de Trasalado',
                        type: 'requisition',
                        orderId: req_detail.id,
                        product: stock.product,
                        sucursal: stock.sucursal,
                    }, { transaction: t });

                } else {

                    let req_detail = await RequisitionDetail.findOne({
                        where: {
                            requisition: requisition.id,
                            product: product.id,
                            sale_detail: detail.id
                        }
                    });

                    if (req_detail == null) {

                        let req_detail = await RequisitionDetail.create({
                            requisition: requisition.id,
                            product: product.id,
                            client: data.client,
                            cant: data.cant,
                            createdBy,
                            client_name: client.name,
                            user: userid,
                            sale_detail: detail.id
                        }, { transaction: t });
                        let reserve = await StockReserve.create({
                            cant: data.cant,
                            createdBy,
                            concept: 'Reserva por Solicitudes de Trasalado',
                            type: 'requisition',
                            orderId: req_detail.id,
                            product: stock.product,
                            sucursal: stock.sucursal,
                            saleId: detail.id
                        }, { transaction: t });

                    } else {
                        req_detail.cant = req_detail.cant + data.cant;
                        await req_detail.save({ transaction: t });

                        let reserve = await StockReserve.findOne({
                            where: {
                                product: data.product,
                                sucursal: stock.sucursal,
                                orderId: req_detail.id
                            }
                        });

                        // realizar raw sql aqui
                        reserve.cant = Number.parseInt(reserve.cant + data.cant);
                        await reserve.save({ transaction: t });
                    }

                    //Actualizar el producto

                    //realizar raws sql aqui
                    // stock.reserved = stock.reserved + data.cant;
                    // await stock.save({ transaction: t });
                    await sequelize.query(
                        "UPDATE `inventory_product_stock` SET `reserved` = reserved + :cant WHERE id = :stock_id",
                        {
                            replacements: {
                                cant: data.cant, stock_id: stock.id
                            },
                            type: QueryTypes.UPDATE,
                            transaction: t
                        }
                    );

                    //realizar raws sql aqui
                    //  product.reserved = product.reserved + data.cant;
                    //  await product.save({ transaction: t });
                    await sequelize.query(
                        "UPDATE `inventory_product` SET `reserved` = reserved + :cant WHERE id = :product_id",
                        {
                            replacements: {
                                cant: data.cant, product_id: product.id
                            },
                            type: QueryTypes.UPDATE,
                            transaction: t
                        }
                    );
                }


                return res.json({
                    status: 'success',
                    message: 'Guardado',
                });
            });

        } catch (error) {
            console.error(error);
            message = error.message !== undefined ? error.message : error;
            return { status: 'errorMessage', message: message, data: error };
        }
    },


    socket_add_detail: async (data, session) => {
        if (data.cant < 1) {
            return { status: 'errorMessage', message: 'Agrega una cantidad' };
        } else if (data.price < 0 || data.price == "") {
            return { status: 'errorMessage', message: 'El precio no es valido' };
        } else if (data.client < 1 || data.client == "") {
            return { status: 'errorMessage', message: 'Cliente no seleccionado' };
        }

        //buscar el cliente
        let client = await Client.findByPk(data.client).catch(err => {
            console.log(err)
            next(err);
        });

        if (client == null) {
            return { status: 'errorMessage', message: 'Cliente no seleccionado' };
        }

        if (client.seller !== session.employee.id && !session.permission.includes('update_sales_of_another_user')) {
            return { status: 'errorMessage', message: 'No tienes permiso para agregar productos a este cliente' };
        }


        try {
            data.cant = Number.parseInt(data.cant);
            data.price = Number.parseFloat(data.price);

            let sale = await Sale.findOne({
                where: {
                    [Op.and]: {
                        client: data.client,
                        _status: 'process'
                    }
                }
            });


            let detail_count = 0;
            let detail = null;
            if (sale !== null && sale !== undefined) {
                if (sale.sucursal !== session.employee.sucursal ) {
                    // Eliminado el permiso && !session.permission.includes('update_sales_of_another_sucursal') porque reservaba cosas de la sucursal incorrecta
                    throw 'No puedes agregar productos a una venta de otra sucursal';
                }
                //token
                detail_count = await SaleDetail.count({ where: { sale: sale.id } });
            }

            let product = await Product.findByPk(data.product);
            if (product == null) {
                throw 'Producto no encontrado';
            }

            //buscar el stock que pertenece a la sucursal seleccionada


            let stock = await Stock.findOne({
                where: {
                    product: data.product,
                    sucursal: session.employee.sucursal
                }
            });


            if (stock == null || stock == undefined || (stock.cant - stock.reserved < data.cant)) {

                throw 'No hay suficientes ecistencias en tu sucursal asignada para poder agregar este producto';
            }

            //buscar a ver si ya hay un detalle existente
            if (detail_count > 0) {
                detail = await SaleDetail.findOne({
                    where: {
                        [Op.and]: {
                            sale: sale.id,
                            product: data.product,
                            price: data.price
                        }
                    }
                });
            }

            return await sequelize.transaction(async (t) => {

                if (sale == null) {
                    let last_sale = await Sale.findOne({
                        where: {
                            client: client.id
                        },
                        order: [
                            ['id', 'DESC']
                        ]
                    });

                    sale = await Sale.create({
                        client: client.id,
                        seller: session.employee.id,
                        sucursal: session.employee.sucursal,
                        credit_conditions: 0,
                        _status: 'process',
                        type: client.type,
                        delivery_type: last_sale != null ? last_sale.delivery_type : 'delivery',
                        balance: 0.00
                    }, { transaction: t });
                }

                sale.balance = sale.balance + Helper.fix_number(data.cant * data.price);
                await sale.save({ transaction: t });

                if (detail !== null) {
                    detail.cant = detail.cant + data.cant;
                    detail.reserved = detail.reserved + data.cant;
                    await detail.save({ transaction: t });


                    //buscar la reserva y actualizarla
                    let reserve = await StockReserve.findOne({
                        where: {
                            product: data.product,
                            saleId: detail.id,
                            sucursal: stock.sucursal
                        }
                    });

                    if (reserve) {
                        reserve.cant = (reserve.cant + data.cant);
                        await reserve.save({ transaction: t });
                    } else {
                        let reserve = await StockReserve.create({
                            cant: data.cant,
                            createdBy: session.shortName,
                            concept: 'reserva por venta',
                            type: 'sale',
                            saleId: detail.id,
                            product: stock.product,
                            sucursal: stock.sucursal,
                        }, { transaction: t });
                    }
                } else {
                    detail = await SaleDetail.create({
                        sale: sale.id,
                        product: product.id,
                        price: data.price,
                        description: product.name + ' SKU ' + product.sku,
                        image: product.raw_image_name,
                        _order: detail_count,
                        cant: data.cant,
                        ready: 0,
                        delivered: 0,
                        reserved: data.cant
                    }, { transaction: t });

                    //crear la reserva

                    let reserve = await StockReserve.create({
                        cant: data.cant,
                        createdBy: session.shortName,
                        concept: 'reserva por venta',
                        type: 'sale',
                        saleId: detail.id,
                        product: stock.product,
                        sucursal: stock.sucursal,
                    }, { transaction: t });

                }

                await sequelize.query(
                    "UPDATE `inventory_product_stock` SET `reserved` = reserved + :cant WHERE id = :stock_id",
                    {
                        replacements: {
                            cant: data.cant,
                            stock_id: stock.id
                        },
                        type: QueryTypes.UPDATE,
                        transaction: t
                    }
                );
                await sequelize.query(
                    "UPDATE `inventory_product` SET `reserved` = reserved + :cant WHERE id = :product_id",
                    {
                        replacements: {
                            cant: data.cant,
                            product_id: product.id
                        },
                        type: QueryTypes.UPDATE,
                        transaction: t
                    }
                );

                return { status: 'success', message: 'Guardado', data: { detail, balance: sale.balance } };
            });

        } catch (error) {
            console.error('\n\n', error, '\n\n');
            message = error.message !== undefined ? error.message : error;
            return { status: 'errorMessage', message: message, data: error };
        }

    },

    socket_delete_detail: async (data) => {

        
        //obtener el detalle
        let detail = await SaleDetail.findByPk(data.detail_id);

        if (detail) {
            let sale = await Sale.findByPk(detail.sale).catch(err => next(err));
            if (sale) {
                if (sale._status != 'process') {
                    return { status: 'errorMessage', message: 'Ya no se puede modificar esta venta' };
                }
                //Verificar si la venta tiene mas detalles
                let count = await SaleDetail.count({
                    where: {
                        sale: sale.id,
                        id: {
                            [Op.ne]: detail.id
                        }
                    }
                });

                //Guardar el subtotal del detalle
                let old_amount = Number.parseInt(detail.cant) * Number.parseFloat(detail.price);
                //Obtener el valo maximo liberable y formatear la cantidad
                let max_liberable = detail.reserved - detail.ready;
                data.cant = Number.parseInt(data.cant > max_liberable ? max_liberable : data.cant);

                if (data.cant < 1) {
                    return { status: 'errorMessage', message: 'Cantidad Liberable Cero, no se puede liberar por medio de esta opción', data: error.message };
                }


                //Busca la reserva en la sucursal de la venta
                let reserve = await StockReserve.findOne({
                    where: {
                        [Op.and]: {
                            saleId: detail.id,
                            product: detail.product,
                            sucursal: sale.sucursal
                        }
                    },
                });

                let stock = await Stock.findOne({
                    where: {
                        product: detail.product,
                        sucursal: sale.sucursal
                    }
                });
                //buscar el producto
                let product = await Product.findByPk(detail.product);
                if (product && stock && reserve) {
                    console.log('\n\n', 'Eliminando Detalle desde el Socket', '\n\n');
                    try {

                        return await sequelize.transaction(async (t) => {
                            //actualizar y guardar venta
                            sale.balance = Helper.fix_number(sale.balance - (data.cant * detail.price));

                            if (data.cant == detail.cant) {
                                // destuir detalle y reserva
                                await detail.destroy({ transaction: t });
                                await reserve.destroy({ transaction: t });

                                detail = null;
                            } else {
                                //Disminuir reserva
                                if (reserve.cant > data.cant) {
                                    reserve.cant = Number.parseInt(reserve.cant - data.cant);
                                    await reserve.save({ transaction: t });
                                } else {
                                    reserve.destroy({ transaction: t });
                                }
                                //Disminuir Detalle
                                detail.cant = Number.parseInt(detail.cant - data.cant);
                                detail.reserved = Number.parseInt(detail.reserved - data.cant);
                                await detail.save({ transaction: t });
                            }

                            
                            //Actualizar Stock y  Actuañlizar Producto
                            await sequelize.query(
                                "UPDATE `inventory_product_stock` SET `reserved` = reserved - :cant WHERE id = :stock_id",
                                {
                                    replacements: {
                                        cant: data.cant,
                                        stock_id: stock.id
                                    },
                                    type: QueryTypes.UPDATE,
                                    transaction: t
                                }
                            );
                            await sequelize.query(
                                "UPDATE `inventory_product` SET `reserved` = reserved - :cant WHERE id = :product_id",
                                {
                                    replacements: {
                                        cant: data.cant,
                                        product_id: product.id
                                    },
                                    type: QueryTypes.UPDATE,
                                    transaction: t
                                }
                            );

                            let _sale_id = sale.id;
                            if (count < 1 && detail == null) {
                                await sale.destroy({ transaction: t });
                                sale = null;
                            } else {
                                sale = await sale.save({ transaction: t });
                            }
                            return {
                                status: 'success',
                                message: 'Guardado',
                                detail,
                                balance: sale !== null ? sale.balance : null,
                                sale_id: _sale_id
                            };

                        });
                    } catch (error) {
                        console.error(error);
                        console.log('\n\n', error, '\n\n');
                        return { status: 'errorMessage', message: 'Venta o Pedido no encontrado', data: error.message };
                    }
                } else {
                    return { status: 'errorMessage', message: 'Algo esta mal con este producto, por favor notifica al desarrollador del sistema' };
                }
            } else {
                return { status: 'errorMessage', message: 'Venta o Pedido no encontrado' };
            }
        } else {
            return { status: 'errorMessage', message: 'Detalle no encontrado' };
        }
    },


    socket_save_sale_in_room: async (data, session) => {
        // console.log(session)

        data.sucursal = session.employee.sucursal;
        if (data.dt.length < 1) {
            return { status: 'error', message: 'Agregue los productos a la venta' }
        } else {
            let client = await Client.findByPk(data.client);
            if (client == null) {
                return { status: 'error', message: 'Client not Found' }
            }

            var sucursal = await Sucursal.findByPk(session.employee.sucursal);

            //verificar los datos de facturacion
            //buscar la serie
            let serie = await InvoiceSeries.findByPk(data.invoice_serie);
            if (serie == null) {
                return { status: 'error', message: 'Seleccione el tipo de documento' }
            }

            //verificar si el numero del documento esta dentro del rango de la serie
            if (serie.init > data.invoice_number || data.invoice_number > serie.end) {
                return { status: 'error', message: `Este numero de Documento esta fuera del rango registrado, coloque un numero entre ${serie.init} y ${serie.end}` }
            }


            //buscar una venta que tenga el mismo numero de factura
            let existe = await Sale.count({
                where: {
                    invoce_serie: data.invoice_serie,
                    invoice_number: data.invoice_number,
                }
            });

            if (existe > 0) {
                return { status: 'error', message: 'Este numero de Documento ya esta registrado con la serie Seleccionada' }
            }

            //verificar los datos dependiendo del tipo de documento
            let update_client = false;

            if (serie.type == 'ccf') {
                if (data.invoice_data.direction.length < 5) {
                    return { status: 'error', message: 'Coloque la direccion para el Credito Fiscal' }
                } else if (data.invoice_data.nrc.length < 3) {
                    return { status: 'error', message: 'Coloque el Numero de Registro para el Credito Fiscal' }
                }




                //verificar si los datos del cliente deben ser actualizados

                if (client.NRC == null || client.NRC == "") {
                    client.NRC = data.invoice_data.nrc;
                    update_client = true;
                }
            }



            try {
                return await sequelize.transaction(async (t) => {
                    let sale = await Sale.create({
                        client: client.id,
                        seller: session.employee.id,
                        sucursal: session.employee.sucursal,
                        credit_conditions: 0,
                        _status: 'collected',
                        type: client.type,
                        balance: 0.00,
                        delivery_type: 'local',
                        delivery_amount: 0.00,
                        invoce_serie: serie.id,
                        invoice_type: serie.type,
                        invoice_number: data.invoice_number,
                        invoice_data: data.invoice_data,
                        invoice_date: new Date(data.invoice_data.invoice_date + 'T06:00:00'),
                        invoice_resume: data.invoice_resume.length > 0 ? data.invoice_resume : null,
                        invoice_retention: data.invoice_retention == true,
                        invoice_isr: data.invoice_isr == true,
                    }, { transaction: t });



                    serie.used++;
                    await serie.save({ transaction: t });


                    let balance = 0.00,
                        sale_cost = 0.00,
                        ids = [],
                        products = {},
                        stocks = {},
                        _details = [];
                    //recorrer los detalles de y obtener los ID de los productos
                    data.dt.forEach(detail => ids.push(detail.product));

                    //buscar los productos
                    let tmp = await Product.findAll({
                        where: {
                            id: { [Op.in]: ids }
                        }
                    });

                    tmp.forEach(prod => products[prod.id] = prod);

                    //buscar los stock
                    tmp = await Stock.findAll({
                        where: {
                            product: { [Op.in]: ids },
                            sucursal: sucursal.id
                        }
                    });

                    tmp.forEach(prod => stocks[prod.product] = prod);

                    //recorrer los detalles

                    var len = data.dt.length;
                    var concept = `Operación en sala de ventas, cliente ${client.name}`;

                    for (let index = 0; index < len; index++) {
                        let dt = data.dt[index],
                            product = products[dt.product],
                            stock = stocks[dt.product];

                        if (product == undefined || stock == undefined) {
                            throw "Product or Stock not Found";
                        }

                        let max = stock.cant - stock.reserved;

                        if (dt.cant > max) {
                            dt.cant = max;
                        }

                        let detail = {
                            sale: sale.id,
                            product: dt.product,
                            price: dt.price,
                            description: product.name + ' SKU ' + product.sku,
                            image: product.raw_image_name,
                            _order: index + 1,
                            cant: dt.cant,
                            ready: dt.cant,
                            delivered: dt.cant,
                            reserved: dt.cant,
                            product_cost: product.cost,
                        };

                        detail = await SaleDetail.create(detail, { transaction: t });
                        _details.push(detail);
                        balance += Number.parseFloat(dt.cant * dt.price);
                        sale_cost += Number.parseFloat(dt.cant * product.cost);


                        //generar el movimiento de salida
                        let movement = await Movement.create({
                            product: stock.product,
                            sucursal: stock.sucursal,
                            cant: dt.cant,
                            last_sucursal_stock: stock.cant,
                            last_product_stock: product.stock,
                            cost: product.cost,
                            last_cost: product.cost,
                            sale_detail: detail.id,
                            concept: concept,
                            in: false,
                        }, { transaction: t });

                        //Actualizar el producto descontando la cantidad
                        product.stock -= dt.cant;
                        await product.save({ transaction: t });

                        stock.cant -= dt.cant;
                        await stock.save({ transaction: t });

                    }


                    let payments_ids = [];


                    if (data.payment.money > 0) {
                        //generar el Ingreso a la caja Chica
                        let _move = await PettyCashMoves.create({
                            amount: data.payment.money,
                            last_amount: sucursal.balance,
                            concept: `Ingreso por Venta en Sala, cliente ${client.name} venta ID: ${sale.id} (${sale.invoice_type} N°
                                ${sale.invoice_number})`,
                            petty_cash: sucursal.id,
                            type: 'payment',
                            isin: true,
                            createdBy: session.shortName,
                            asigned_to: client.name,
                            _number: 0,
                        }, { transaction: t });

                        let id = await SalePayment.create({
                            client: client.id,
                            sales: [{ 'id': sale.id, amount: data.payment.money },],
                            type: 'money',
                            amount: data.payment.money,
                            asigned_amount: data.payment.money,
                            createdBy: session.shortName,
                        }, { transaction: t });

                        payments_ids.push({ id: id.id, amount: data.payment.money })

                        sucursal.balance += Number.parseFloat(data.payment.money);
                        await sucursal.save({ transaction: t });

                    }



                    if (data.payment.transfer.amount > 0) {
                        //recorrer los detalles y realizar los registros
                        let len = data.payment.transfer.details.length;
                        for (let index = 0; index < len; index++) {
                            const element = data.payment.transfer.details[index];
                            let id = await SalePayment.create({
                                client: client.id,
                                sales: [{ 'id': sale.id, amount: element.amount },],
                                type: 'transfer',
                                amount: element.amount,
                                asigned_amount: element.amount,
                                bank: element.bank,
                                reference: element.reference,
                                createdBy: session.shortName,
                            }, { transaction: t });


                            payments_ids.push({ id: id.id, amount: element.amount });

                        }
                    }


                    if (data.payment.credit_card.amount > 0) {
                        //recorrer los detalles y realizar los registros

                        let len = data.payment.credit_card.details.length;
                        for (let index = 0; index < len; index++) {
                            const element = data.payment.credit_card.details[index];
                            let id = await SalePayment.create({
                                client: client.id,
                                sales: [{ 'id': sale.id, amount: element.amount },],
                                type: 'credit_card',
                                amount: element.amount,
                                asigned_amount: element.amount,
                                bank: element.bank,
                                reference: element.reference,
                                createdBy: session.shortName,
                            }, { transaction: t });


                            payments_ids.push({ id: id.id, amount: element.amount });

                        }

                    }

                    sale.balance = balance;
                    sale.collected = balance;
                    sale.cost = sale_cost;
                    sale.payments = payments_ids;


                    //poner aca los taxes

                    let sin_iva = Helper.fix_number(sale.balance / 1.13);
                    sale.taxes = {
                        iva: Helper.fix_number(sale.balance - sin_iva),
                        retention: sale.invoice_retention && sin_iva > 100 ? Helper.fix_number(sin_iva * process.env.RETENTION) : 0.00,
                        perception: 0.00,
                        isr: sale.invoice_isr ? Helper.fix_number(sin_iva * process.env.RET_ISR) : 0.00,
                    }

                    await sale.save({ transaction: t });

                    if (update_client == true) {
                        await client.save({ transaction: t });
                    }
                    return { status: 'success', message: 'Guardado', sale: sale.id }
                });
            } catch (error) {
                console.error(error);
                return { status: 'error', message: error.message }
            }
        }
    },

    socket_not_delivery: async (data) => {
        //obtener el detalle
        let sale = await Sale.findByPk(data.sale).catch(err => next(err));

        let detail = await SaleDetail.findAll({
            where: {
                sale: data.sale
            }
        });
        if (detail && sale) {
            try {
                let count = await SaleDetail.count({ where: { sale: sale.id } }) - 1;

                return await sequelize.transaction(async (t) => {

                    let old_amount = Number.parseInt(detail.cant) * Number.parseFloat(detail.price);

                    data.price = data.price !== undefined ? Number.parseFloat(data.price) : 0;
                    data.cant = Number.parseInt(data.cant > detail.cant ? detail.cant : data.cant);

                    if (detail.product == null || detail.reserved == 0) {
                        if (data.cant == detail.cant) {
                            //actualizar el monto de la venta
                            sale.balance = Number.parseFloat(sale.balance) - old_amount;
                            //detruir el detalle
                            let location = path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images', detail.img);
                            await detail.destroy({ transaction: t });
                            detail = null;
                            //eliminar la imagen temporal
                            fs.unlink(location, (err) => { if (err) { console.log(err); } else { console.log('image deleted'); } });
                        } else {
                            // reducir el detalle
                            detail.cant -= data.cant;
                            await detail.save();
                            sale.balance = Number.parseFloat(sale.balance) - old_amount + (Number.parseInt(detail.cant) * Number.parseFloat(detail.price));
                        }
                    } else {
                        //buscar el producto

                        let product = await Product.findByPk(detail.product);

                        //buscar las reservas que esten relacionadas con el stock del producto
                        let reserves = await StockReserve.findAll({
                            where: {
                                [Op.and]: {
                                    saleId: detail.id,
                                    product: detail.product
                                }
                            },
                            order: [['id', 'DESC']]
                            //por la creacion se tiene como prioridad la sucursal del empleado que registra, para la eliminacion se tendra como prioridad las otras sucursales
                        });
                        //buscar los stock que esten relacionados con el producto, se puede optimizar
                        let tmp = await Stock.findAll({ where: { product: detail.product }, order: [['id', 'DESC']] });
                        let stocks = {};
                        tmp.forEach(element => stocks[element.sucursal] = element);
                        //Si hay producto revisado no se puede eliminar por tanto cambiaremos el valor maximo para tomar el valor de lo que no esta revisado
                        if (detail.ready > 0) {
                            //significa que hay parte ya revisada, la cual no se puede quitar asi por asi
                            let revertible = detail.cant - detail.ready;
                            if (data.cant > revertible) {
                                let sol = data.cant - revertible;
                                data.cant = revertible;
                                //realizar solicitud de reversion si se quiere hacer en automatico
                            }

                        }
                        if (data.cant > 0) {
                            //si la cantidad es igual a la cantidad del detalle vamos a eliminarlo
                            if (data.cant == detail.cant) {
                                //buscar las reservas y destruirlas
                                for (let index = 0; index < reserves.length; index++) {
                                    let reserve = reserves[index];
                                    let stock = stocks[reserve.sucursal];

                                    stock.reserved -= reserve.cant;
                                    await stock.save({ transaction: t });
                                    await reserve.destroy({ transaction: t });
                                }

                                await detail.destroy({ transaction: t });
                                detail = null;
                                sale.balance = Number.parseFloat(sale.balance) - old_amount;
                                product.reserved -= data.cant;
                                await product.save({ transaction: t });
                            } else {

                                //si no a reducirlo
                                let faltante = data.cant;

                                for (let index = 0; index < reserves.length; index++) {
                                    if (faltante > 0) {
                                        let reserve = reserves[index];
                                        let stock = stocks[reserve.sucursal];

                                        if (faltante > reserve.cant) {
                                            //destruir la reserva
                                            stock.reserved -= reserve.cant;
                                            await stock.save({ transaction: t });
                                            await reserve.destroy({ transaction: t });
                                        } else {
                                            //reducir la reserva
                                            reserve.cant -= faltante;
                                            stock.reserved -= faltante;
                                            await stock.save({ transaction: t });
                                            await reserve.save({ transaction: t });
                                        }
                                    }
                                }
                                detail.cant -= data.cant;
                                detail.reserved -= data.cant;
                                product.reserved -= data.cant;
                                await product.save({ transaction: t });
                                await detail.save({ transaction: t });
                                sale.balance = Number.parseFloat(sale.balance) - old_amount + (Number.parseInt(detail.cant) * Number.parseFloat(detail.price));
                            }
                        }
                    }


                    let _sale_id = sale.id;

                    if (count < 1 && detail == null) {
                        await sale.destroy({ transaction: t });
                        sale = null;
                    } else {
                        sale = await sale.save({ transaction: t });
                    }
                    return { status: 'success', message: 'Guardado', detail, balance: sale !== null ? sale.balance : null, sale_id: _sale_id };

                });
            } catch (error) {
                console.error(error);
                return { status: 'errorMessage', message: 'Venta o Pedido no encontrado', data: error.message };
            }

        } else {
            return { status: 'errorMessage', message: 'Sale or details not Found' };
        }
    },

    //OLDS
    socket_add_detail_old: async (data, session) => {
        if (data.cant < 1) {
            return { status: 'errorMessage', message: 'Agrega una cantidad' };
        } else if (data.price < 0 || data.price == "") {
            return { status: 'errorMessage', message: 'El precio no es valido' };
        } else if (data.client < 1 || data.client == "") {
            return { status: 'errorMessage', message: 'Cliente no seleccionado' };
        }

        //buscar el cliente
        let client = await Client.findByPk(data.client).catch(err => next(err));
        if (client == null) {
            return { status: 'errorMessage', message: 'Cliente no seleccionado' };
        }

        try {
            data.cant = Number.parseInt(data.cant);
            data.price = Number.parseFloat(data.price);

            return await sequelize.transaction(async (t) => {
                let sale = null, detail_count = 0;

                sale = await Sale.findOne({
                    where: {
                        [Op.and]: {
                            client: data.client,
                            _status: 'process'
                        }
                    }
                });


                // console.log(sale)

                // if (data.sale != "" || data.sale != null) {
                //     sale = await Sale.findByPk(data.sale);
                // }else{
                // }

                if (sale) {
                    detail_count = await SaleDetail.count({ where: { sale: sale.id } });
                }


                if (sale == null) {
                    sale = await Sale.create({
                        client: client.id,
                        seller: session.employee.id,
                        sucursal: session.employee.sucursal,
                        credit_conditions: 0,
                        _status: 'process',
                        type: client.type,
                        balance: 0.00
                    }, { transaction: t });
                }

                let detail = {
                    sale: sale.id,
                    product: null,
                    price: data.price,
                    description: null,
                    image: null,
                    _order: detail_count,
                    cant: data.cant,
                    ready: 0,
                    delivered: 0,
                    reserved: 0
                };

                sale.balance = Number.parseFloat(sale.balance) + (data.cant * data.price);
                await sale.save({ transaction: t });
                let existe = null;
                let product = null;
                if (data.case == 'inventory') {
                    //buscar el productoo
                    product = await Product.findByPk(data.product);
                    if (product == null) {
                        throw 'Producto no encontrado';

                        console.log('rollback por product not found')
                        return { status: 'errorMessage', message: 'Producto no encontrado' };
                    }
                    //buscar a ver si ya hay un detalle existente
                    existe = await SaleDetail.findOne({
                        where: {
                            [Op.and]: {
                                sale: sale.id,
                                product: product.id,
                                price: data.price
                            }
                        }
                    });

                    if (existe !== null) {
                        existe.cant += data.cant;
                        await existe.save({ transaction: t })
                    } else {
                        detail.description = product.name + ' SKU ' + product.sku;
                        detail.product = product.id;
                        detail.image = product.raw_image_name;
                    }

                } else {
                    detail.description = data.description;

                    let image_name = null;
                    if (data.image.length > 1) {
                        image_name = 'sd_temp_' + Helper.generateNameForUploadedFile() + '.jpg';
                        let location = path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images', image_name);
                        let image_data = data.image.slice(23);
                        fs.writeFile(location, image_data, 'base64', (err) => { if (err) { console.log(err) } });
                    }
                    detail.image = image_name;
                }

                //buscar ah ver si existe un detalle anterior
                detail = existe !== null ? existe : await SaleDetail.create(detail, { transaction: t });

                if (data.case == 'inventory') {
                    //buscar los stock e indexarlos
                    let tmp = await sequelize.query('SELECT * FROM `inventory_product_stock` WHERE product = :id and cant > reserved;', {
                        replacements: { id: data.product, },
                        type: QueryTypes.SELECT,
                        model: Stock,
                    });

                    var stocks = [],
                        stock = null;
                    if (tmp.length > 0) {
                        tmp.forEach(element => {
                            if (element.sucursal == sale.sucursal) {
                                stock = element;
                            } else {
                                stocks.push(element);
                            }
                        });
                    } else {
                        throw 'Existencias no econtradas';
                        console.log('RollBack por falta de stocks')
                        return { status: 'errorMessage', message: 'Existencias no econtradas' };
                    }


                    var faltante = data.cant;
                    //buscar el stock de la sucursal de la venta
                    if (stock != null) {

                        let disponible = stock.cant - stock.reserved;
                        if (disponible > faltante) {
                            stock.reserved += faltante;
                            await stock.save({ transaction: t });


                            //buscar una reserva que coincida con el producto, sucursal e id del detalle
                            let reserve = await StockReserve.findOne({
                                where: {
                                    [Op.and]: {
                                        type: 'sale',
                                        saleId: detail.id,
                                        product: stock.product,
                                        sucursal: stock.sucursal,
                                    }
                                }
                            });

                            if (reserve !== null) {
                                reserve.cant += faltante;
                                await reserve.save({ transaction: t });
                            } else {
                                //Si no existe, crearlo
                                reserve = await StockReserve.create({
                                    cant: faltante,
                                    createdBy: session.shortName,
                                    concept: 'reserva por venta',
                                    type: 'sale',
                                    saleId: detail.id,
                                    product: stock.product,
                                    sucursal: stock.sucursal,
                                }, { transaction: t });
                            }

                            faltante = 0;
                        } else {
                            stock.reserved += disponible;
                            await stock.save({ transaction: t });

                            //registrar la reserva
                            //buscar una reserva que coincida con el producto, sucursal e id del detalle
                            let reserve = await StockReserve.findOne({
                                where: {
                                    [Op.and]: {
                                        type: 'sale',
                                        saleId: detail.id,
                                        product: stock.product,
                                        sucursal: stock.sucursal,
                                    }
                                }
                            });

                            if (reserve !== null) {
                                reserve.cant += disponible;
                                await reserve.save({ transaction: t });
                            } else {
                                reserve = await StockReserve.create({
                                    cant: disponible,
                                    createdBy: session.shortName,
                                    concept: 'reserva por venta',
                                    type: 'sale',
                                    saleId: detail.id,
                                    product: stock.product,
                                    sucursal: stock.sucursal,
                                }, { transaction: t });
                            }
                            faltante -= disponible;
                        }
                    }

                    //Bloque para reservas multisucursal
                    if (faltante > 0 && false) {
                        for (let index = 0; index < stocks.length; index++) {
                            const stock = stocks[index];
                            if (faltante > 0) {
                                let disponible = stock.cant - stock.reserved;
                                if (disponible > faltante) {
                                    stock.reserved += faltante;
                                    await stock.save({ transaction: t });

                                    //buscar una reserva que coincida con el producto, sucursal e id del detalle
                                    let reserve = await StockReserve.findOne({
                                        where: {
                                            [Op.and]: {
                                                type: 'sale',
                                                saleId: detail.id,
                                                product: stock.product,
                                                sucursal: stock.sucursal,
                                            }
                                        }
                                    });

                                    if (reserve !== null) {
                                        reserve.cant += faltante;
                                        await reserve.save({ transaction: t });
                                    } else {
                                        //registrar la reserva
                                        reserve = await StockReserve.create({
                                            cant: faltante,
                                            createdBy: session.shortName,
                                            concept: 'reserva por venta',
                                            type: 'sale',
                                            saleId: detail.id,
                                        }, { transaction: t });
                                    }
                                    faltante = 0;
                                } else {
                                    stock.reserved += disponible;
                                    await stock.save({ transaction: t });

                                    //buscar una reserva que coincida con el producto, sucursal e id del detalle
                                    let reserve = await StockReserve.findOne({
                                        where: {
                                            [Op.and]: {
                                                type: 'sale',
                                                saleId: detail.id,
                                                product: stock.product,
                                                sucursal: stock.sucursal,
                                            }
                                        }
                                    });

                                    if (reserve !== null) {
                                        reserve.cant += disponible;
                                        await reserve.save({ transaction: t });
                                    } else {
                                        reserve = await StockReserve.create({
                                            cant: disponible,
                                            createdBy: session.shortName,
                                            concept: 'reserva por venta',
                                            type: 'sale',
                                            saleId: detail.id,
                                        }, { transaction: t });
                                    }
                                    faltante -= disponible;
                                }
                            }
                        }
                    }

                    detail.reserved += data.cant - faltante;
                    await detail.save({ transaction: t });

                    product.reserved += data.cant - faltante;
                    await product.save({ transaction: t });
                }
                return { status: 'success', message: 'Guardado', data: { detail, balance: sale.balance } };
            });

        } catch (error) {
            console.error(error);
            return { status: 'errorMessage', message: 'Error Interno', data: error.message };
        }

    },

    socket_delete_detail_old: async (data) => {
        //obtener el detalle
        let detail = await SaleDetail.findByPk(data.detail_id);

        if (detail) {

            let sale = await Sale.findByPk(detail.sale).catch(err => next(err));
            if (sale) {
                if (sale._status != 'process') {
                    return { status: 'errorMessage', message: 'Ya no se puede modificar esta venta' };
                }
                try {
                    let count = await SaleDetail.count({ where: { sale: sale.id } }) - 1;

                    return await sequelize.transaction(async (t) => {

                        let old_amount = Number.parseInt(detail.cant) * Number.parseFloat(detail.price);

                        data.price = data.price !== undefined ? Number.parseFloat(data.price) : 0;
                        data.cant = Number.parseInt(data.cant > detail.cant ? detail.cant : data.cant);

                        if (detail.product == null || detail.reserved == 0) {
                            if (data.cant == detail.cant) {
                                //actualizar el monto de la venta
                                sale.balance = Number.parseFloat(sale.balance) - old_amount;
                                //detruir el detalle
                                let location = path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images', detail.img);
                                await detail.destroy({ transaction: t });
                                detail = null;
                                //eliminar la imagen temporal
                                fs.unlink(location, (err) => { if (err) { console.log(err); } else { console.log('image deleted'); } });
                            } else {
                                // reducir el detalle
                                detail.cant -= data.cant;
                                await detail.save();
                                sale.balance = Number.parseFloat(sale.balance) - old_amount + (Number.parseInt(detail.cant) * Number.parseFloat(detail.price));
                            }
                        } else {
                            //buscar el producto

                            let product = await Product.findByPk(detail.product);

                            //buscar las reservas que esten relacionadas con el stock del producto
                            let reserves = await StockReserve.findAll({
                                where: {
                                    [Op.and]: {
                                        saleId: detail.id,
                                        product: detail.product
                                    }
                                },
                                order: [['id', 'DESC']]
                                //por la creacion se tiene como prioridad la sucursal del empleado que registra, para la eliminacion se tendra como prioridad las otras sucursales
                            });
                            //buscar los stock que esten relacionados con el producto, se puede optimizar
                            let tmp = await Stock.findAll({ where: { product: detail.product }, order: [['id', 'DESC']] });
                            let stocks = {};

                            tmp.forEach(element => stocks[element.sucursal] = element);
                            //Si hay producto revisado no se puede eliminar por tanto cambiaremos el valor maximo para tomar el valor de lo que no esta revisado
                            if (detail.ready > 0) {
                                //significa que hay parte ya revisada, la cual no se puede quitar asi por asi
                                let revertible = detail.cant - detail.ready;
                                if (data.cant > revertible) {
                                    let sol = data.cant - revertible;
                                    data.cant = revertible;
                                    //realizar solicitud de reversion si se quiere hacer en automatico
                                }

                            }
                            if (data.cant > 0) {
                                //si la cantidad es igual a la cantidad del detalle vamos a eliminarlo
                                if (data.cant == detail.cant) {
                                    //buscar las reservas y destruirlas
                                    for (let index = 0; index < reserves.length; index++) {
                                        let reserve = reserves[index];
                                        let stock = stocks[reserve.sucursal];

                                        stock.reserved -= reserve.cant;
                                        await stock.save({ transaction: t });
                                        await reserve.destroy({ transaction: t });
                                    }

                                    await detail.destroy({ transaction: t });
                                    detail = null;
                                    sale.balance = Number.parseFloat(sale.balance) - old_amount;
                                    product.reserved -= data.cant;
                                    await product.save({ transaction: t });
                                } else {

                                    //si no a reducirlo
                                    let faltante = data.cant;

                                    for (let index = 0; index < reserves.length; index++) {
                                        if (faltante > 0) {
                                            let reserve = reserves[index];
                                            let stock = stocks[reserve.sucursal];

                                            if (faltante > reserve.cant) {
                                                //destruir la reserva
                                                stock.reserved -= reserve.cant;
                                                await stock.save({ transaction: t });
                                                await reserve.destroy({ transaction: t });
                                            } else {
                                                //reducir la reserva
                                                reserve.cant -= faltante;
                                                stock.reserved -= faltante;
                                                await stock.save({ transaction: t });
                                                await reserve.save({ transaction: t });
                                            }
                                        }
                                    }
                                    detail.cant -= data.cant;
                                    detail.reserved -= data.cant;
                                    product.reserved -= data.cant;
                                    await product.save({ transaction: t });
                                    await detail.save({ transaction: t });
                                    sale.balance = Number.parseFloat(sale.balance) - old_amount + (Number.parseInt(detail.cant) * Number.parseFloat(detail.price));
                                }
                            }
                        }


                        let _sale_id = sale.id;

                        if (count < 1 && detail == null) {
                            await sale.destroy({ transaction: t });
                            sale = null;
                        } else {
                            sale = await sale.save({ transaction: t });
                        }
                        return { status: 'success', message: 'Guardado', detail, balance: sale !== null ? sale.balance : null, sale_id: _sale_id };

                    });
                } catch (error) {
                    console.error(error);
                    return { status: 'errorMessage', message: 'Venta o Pedido no encontrado', data: error.message };
                }
            } else {
                return { status: 'errorMessage', message: 'Venta o Pedido no encontrado' };

            }
        } else {
            return { status: 'errorMessage', message: 'Detalle no encontrado' };
        }
    },


    reporte_de_clientes_registrados: async (req, res) => {
        let clients = await Client.findAll({
            where: { seller: 19 },
            order: [
                ['name', 'ASC']
            ]
        });

        return res.render('CRM/Client/registered_clients', { pageTitle: 'Cliente Registrados', clients });

    },

    reporte_de_clientes_registrados2: async (req, res) => {
        //SELECT * FROM `inventory_provider` WHERE NRC is not null and NRC != "";
        let clients = await Provider.findAll({
            where: {
                [Op.and]: [{
                    NRC: { [Op.not]: null, }
                }, {
                    NRC: { [Op.not]: '', }
                }],
            },
            order: [
                ['name', 'ASC']
            ]
        });

        return res.render('CRM/Client/registered_providers', { pageTitle: 'Proveedores Registrados', clients });

    }

};

module.exports = SaleController;