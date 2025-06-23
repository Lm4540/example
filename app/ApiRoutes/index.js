const router = require("express").Router();
const ApiAuth = require('../System/Middleware/ApiAuth');
const ApiController = require('../Web/Controllers/ApiController');
const PosController = require('../CRM/Controllers/PosController');

// Home page route.

router.get("/", function (req, res, next) {
     return res.send("API V1 for web page");
});
router.post("/login", ApiAuth.applicationLogin);
router.post('/client',ApiAuth.authenticateToken,  ApiController.clientAutentication);
router.get('/products', ApiAuth.authenticateToken, ApiController.all_products_for_no_logued);
router.get('/categories', ApiAuth.authenticateToken, ApiController.getCategories);
router.get('/catalog/:client(\\d+)', ApiAuth.authenticateToken, ApiController.getClientCatalogs);
router.get('/catalog/:client(\\d+)/:id(\\d+)', ApiAuth.authenticateToken, ApiController.getCatalog);
router.get('/product/image', ApiAuth.authenticateToken, ApiController.getProductImage2);
router.get('/product_search/:client(\\d+)/:category(\\d+)/:onlyStock(\\d+)', ApiAuth.authenticateToken, ApiController.searchFullProduct);
router.get('/product/detail/:id(\\d+)', ApiAuth.authenticateToken, ApiController.getProductData);
router.get('/client/:client(\\d+)', ApiAuth.authenticateToken, ApiController.updateAccess);
router.get('/product/image/:id(\\d+)', ApiAuth.authenticateToken, ApiController.getProductImage);

router.get('/dte/:id(\\d+)', ApiAuth.authenticateToken, PosController.getDTEforPDF);
router.get('/dte/:uuid/:fecha(\\d{4}-\\d{2}-\\d{2})',  PosController.getDTEPdfByCOde);
router.get('/dte_json/:uuid/:fecha(\\d{4}-\\d{2}-\\d{2})',  PosController.getDTEJsonByCOde);



//rutas de configuracion


module.exports = router;