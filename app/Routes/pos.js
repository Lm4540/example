const router = require("express").Router();
const DTEController = require("../DTE/Controllers/DTEController");
const PosController = require("../CRM/Controllers/PosController");


/**Providers Routes */
router.get('/', PosController.posMode);


module.exports = router;