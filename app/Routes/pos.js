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
router.get('/viewDTE/:id(\\d+)', PosController.viewDTEinLine);
router.get('/getJson/:id(\\d+)', PosController.getJsonById);





module.exports = router;