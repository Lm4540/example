const router = require("express").Router();
const ClientController = require('../CRM/Controllers/ClientController');
const SaleController = require('../CRM/Controllers/SaleController');
const InvoiceController = require('../CRM/Controllers/InvoiceController');
const Auth = require("../System/Middleware/Auth");

// Home page route.
router.get("/", function (req, res) {
    res.render('CRM/index.ejs', {pageTitle: 'Modulo CRM'});
});


/**Providers Routes */
router.get('/client', ClientController.getClientsView);
router.get('/clients', ClientController.clientsToDataTable);

router.get('/client/create', ClientController.getCreationView);
router.post('/client/create', ClientController.createClient);
router.post('/client/create_payment', SaleController.createPayment);
router.post('/client/create_payment2', SaleController.createPayment2);

router.post('/client/re_payment', SaleController.relacionar_pago);

router.post('/client/update', ClientController.updateClient);
router.post('/client/updateData', ClientController.updateClientData);
router.get('/client/:id(\\d+)', ClientController.getClient);
router.get('/client/:id(\\d+)/orders', ClientController.getClientOrders);
router.get('/client/view/:id(\\d+)', ClientController.viewClient);
router.get('/client/select2', ClientController.getClientToSelect2);

router.get('/create/:id(\\d+)', SaleController.createClientSale);


router.post('/addDetail', SaleController.addDetail);
router.post('/updateDetail', SaleController.updateSaleDetail);

router.get('/sale_in_room', SaleController.saleInRoomView);
router.get('/view/:id(\\d+)', SaleController.viewSale);
router.get('/view_cost/:id(\\d+)', SaleController.viewSaleCost);
router.get('/view_pays/:id(\\d+)', SaleController.viewPayments);

router.get('/inProccess', SaleController.inProccess);

router.get('/seller/history', SaleController.seller_history);
router.get('/seller/history/details', SaleController.seller_history_details);
router.post('/seller/history/details', SaleController.seller_history_details_comisioned);


router.get('/history', SaleController.history);
router.get('/history_moves', SaleController.historyData);
router.get('/invoice_serie', SaleController.invoice_serie);
router.post('/invoice_serie', SaleController.save_invoice_serie);
router.post('/update_invoice_serie', SaleController.update_invoice_serie);
router.get('/invoice_options', SaleController.invoice_options);
router.get('/print_invoice/:id(\\d+)', InvoiceController.print_invoice);
router.get('/print_invoice_detail/:id(\\d+)', InvoiceController.print_invoice_detail);

router.get('/view_invoice/:id(\\d+)', InvoiceController.view_invoice);
router.get('/invoice_data/:number(\\d+)/:serie(\\d+)', InvoiceController.invoice_get_data);
router.post('/update_invoice', InvoiceController.update_invoice);
router.post('/invoice/create_invoice', InvoiceController.create_invoice);
router.post('/invoice/revoke_invoice', InvoiceController.revoke_invoice);
router.get('/invoices', InvoiceController.invoice_report);
router.get('/invoices_with_costs',  (req, res, next) => Auth.HasPermission(req, res, next, ['view_invoice_report_with_cost']), InvoiceController.invoice_report2);
router.get('/invoices_details', InvoiceController.invoice_report_details);
router.get('/invoices_details2', InvoiceController.invoice_report_details2);
router.get('/invoices_payments', InvoiceController.invoices_payments);


router.post('/details/quit', (req, res, next) => Auth.HasPermission(req, res, next, ['revoke_sales_details']), SaleController.quit_detail_revised);


//router.get('/corregir_fecha', InvoiceController.corregir_la_fecha);
router.get('/asignar_pagos', SaleController.sale_status_check);

router.get('/test_taxes', InvoiceController.add_taxes);
router.get('/update_prices', (req, res, next) => Auth.HasPermission(req, res, next, ['update_price_list']), SaleController.update_prices);
router.post('/update_price', (req, res, next) => Auth.HasPermission(req, res, next, ['update_price_list']), SaleController.update_price);








/** Sucursal Routes */
/*
router.post('/sale/create', SaleController.createSucursal);
router.post('/sale/update', SaleController.updateSucursal);
router.get('/sale/:id(\\d+)', SaleController.getSucursal);
router.get('/sale/view/:id(\\d+)', SaleController.viewSucursal);

*/

module.exports = router;