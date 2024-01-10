const router = require("express").Router();
const UtilsController = require('../System/Controllers/utilsController');
// Home page route.
router.get("/image_from_url", UtilsController.getImageFromUrl);
router.get('', UtilsController.index);
router.post('/revoke_order', UtilsController.revoke_order);
router.post('/open_order', UtilsController.open_order);

module.exports = router;