const router = require("express").Router();
const UtilsController = require('../System/Controllers/utilsController');
// Home page route.
router.get("/image_from_url", UtilsController.getImageFromUrl);
router.get('', UtilsController.index);

module.exports = router;