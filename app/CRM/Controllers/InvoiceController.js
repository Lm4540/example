const Helper = require("../../System/Helpers");
const Client = require("../Models/Client");
const InvoiceSeries = require("../Models/InvoiceSerie");
const Sale = require("../Models/Sale");
const SaleDetail = require("../Models/SaleDetail");

const InvoiceController = {

    create_invoice: async (req, res) => {

        let data = req.body;
        let sale = await Sale.findByPk(data.sale);
        if (sale) {
            //buscar el numero de serie
            //buscar la serie
            let serie = await InvoiceSeries.findByPk(data.invoice_serie);
            if (serie == null) {
                return res.json({ status: 'errorMessage', message: 'Seleccione el tipo de documento' });
            }

            //verificar si el numero del documento esta dentro del rango de la serie
            if (serie.init > data.invoice_number || data.invoice_number > serie.end) {
                return res.json( { status: 'errorMessage', message: `Este numero de Documento esta fuera del rango registrado, coloque un numero entre ${serie.init} y ${serie.end}` });
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

            console.log('llega aca')
            await sale.save();


            //Actualizar la serie
            serie.used +=1 ;
            await serie.save(); 


            return res.json({
                status: 'success',
                message: "Actualizado con Exito",
                sale: sale.id,
            });



        }

        return Helper.notFound(req, res, "Sale not Found or hasn't been invoced");

    },

    update_invoice: async (req, res) => {
        //buscar la venta
        let data = req.body;
        console.log(data);
        let sale = await Sale.findByPk(data.sale);
        if (sale) {
            data.data.last_update = req.session.userSession.shortName;
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
                },
                raw: true,
            });

            if(sale.delivery_amount !== null && sale.delivery_amount > 0.00){
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
    view_invoice: async (req, res) => {
        //Buscar la venta
        let sale = await Sale.findByPk(req.params.id);

        if (sale && sale.invoice_number !== null) {
            //Buscar los detalles
            let details = await SaleDetail.findAll({
                where: {
                    sale: sale.id,
                },raw: true,
            });
            if(sale.delivery_amount !== null && sale.delivery_amount > 0.00){
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

            return res.render('CRM/Invoice/view-invoice', { pageTitle: `Ver Factura ${sale.invoice_type} N° ${sale.invoice_number}`, sale, details, cliente, data: sale.invoice_data, serie });

        }
        return Helper.notFound(req, res,
            "Invoice not Found or the sale has'nt been invoced ");
    },
};

module.exports = InvoiceController;