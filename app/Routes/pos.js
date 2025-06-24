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


router.get('/create_manual', PosController.create_manual_fc);




module.exports = router;