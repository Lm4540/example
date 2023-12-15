const Helper = require("../../System/Helpers");
const Client = require("../Models/Client");
const InvoiceSeries = require("../Models/InvoiceSerie");
const Sale = require("../Models/Sale");
const SaleDetail = require("../Models/SaleDetail");

const InvoiceController = {

    update_invoice: async(req, res) => {
        //buscar la venta
        let data = req.body;
        let sale = await Sale.findByPk(data.sale);
        if(sale){
            sale.invoice_resume = data.invoice_resume.length ? data.invoice_resume : null;
            sale.invoice_data = data.data;
            sale.invoice_retention = data.invoice_retention == true;
            sale.invoice_isr = data.invoice_isr == true;

            await sale.save();
            return res.json({
                status: 'success',
                message: "Actualizado con Exito"
            });
            
        }

        return Helper.notFound(req, res, "Sale not Found or hasn't been invoced");
    },

    print_invoice: async (req, res) => {
        //Buscar la venta
        let sale = await Sale.findByPk(req.params.id);

        if (sale && sale.invoice_number !== null) {
            //Buscar los detalles
            let details = await SaleDetail.findAll({
                where: {
                    sale: sale.id,
                }
            });

            //buscar el cliente
            let cliente = await Client.findByPk(sale.client);

            //reolver los detalles de la factura

            let serie = await InvoiceSeries.findByPk(sale.invoce_serie);
            //enviar los datos a la vista
            let template = sale.invoice_type == "fcf" ? 'CRM/Invoice/print-fcf' : 'CRM/Invoice/print-ccf';

            return res.render(template, {sale, details, cliente, data: sale.invoice_data, serie});

        }
        return Helper.notFound(req, res,
            "Invoice not Found or the sale has'nt been invoced ");
    },
    view_invoice: async (req, res) => {
        //Buscar la venta
        let sale = await Sale.findByPk(req.params.id);

        if (sale && sale.invoice_number !== null) {
            //Buscar los detalles
            let details = await SaleDetail.findAll({
                where: {
                    sale: sale.id,
                }
            });

            //buscar el cliente
            let cliente = await Client.findByPk(sale.client);

            //reolver los detalles de la factura

            let serie = await InvoiceSeries.findByPk(sale.invoce_serie);
            //enviar los datos a la vista

            return res.render('CRM/Invoice/view-invoice', {pageTitle: `Ver Factura ${sale.invoice_type} N° ${sale.invoice_number}`, sale, details, cliente, data: sale.invoice_data, serie});

        }
        return Helper.notFound(req, res,
            "Invoice not Found or the sale has'nt been invoced ");
    },
};

module.exports = InvoiceController;