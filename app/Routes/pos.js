const router = require("express").Router();
const DTEController = require("../DTE/Controllers/DTEController");
const PosController = require("../CRM/Controllers/PosController");


/**Providers Routes */
router.get('/', PosController.posMode);
router.post('/', PosController.processOrder);
router.get('/client_select2', PosController.getClientToSelect2);
router.get('/getClient', PosController.getClient);
router.get('/getOrder', PosController.getOrder);
router.get('/ordersToBeBilled', PosController.ordersToBeBilled);
router.get('/ordersGuides', PosController.ordersGuides);
router.post('/ordersGuides', PosController.marcarGuia);
router.get('/viewDTE/:id(\\d+)', PosController.view_any_dte);
router.get('/getJson/:id(\\d+)', PosController.getJsonById);
router.get('/getJson/:uuid/:fecha(\\d{4}-\\d{2}-\\d{2})',  PosController.getDTEJsonByCOde);



router.get('/create_manual/:dte', PosController.create_manual_fc);
// router.post('/procces_dte_manual', PosController.simular_contingencia);
router.post('/procces_dte_manual', PosController.process_manual_dte);
router.post('/invalidation_event', PosController.invalidation_dte);
//router.get('/contingencia_event', PosController.contingencia_event);
router.get('/consulta_no_transmitidos', PosController.no_transmitidos);
// router.get('/test', PosController.aaaaaaaaaaaa);


router.get('/report', PosController.dte_report);
router.post('/report', PosController.dte_report_data);
router.get('/cost_report', PosController.dte_cost_report);
router.post('/cost_report', PosController.dte_cost_report_data);




// router.post('/data_to_test', PosController.data_generar_pruebas);




module.exports = router;