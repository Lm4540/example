const router = require("express").Router();
const CatalogController = require("../Web/Controllers/CatalogController");
const Auth = require('../System/Middleware/Auth');

// Home page route.
router.get("/", function (req, res) {
      res.render('Web/index.ejs', { pageTitle: 'Herramientas para la Web' });
});



router.get('/catalogs', (req, res, next) => Auth.HasPermission(req, res, next, ['admin_web_catalogs']), CatalogController.allCatalog);
router.get('/catalog', (req, res, next) => Auth.HasPermission(req, res, next, ['admin_web_catalogs']), CatalogController.getCatalogs);
router.post('/catalog', (req, res, next) => Auth.HasPermission(req, res, next, ['admin_web_catalogs']), CatalogController.createCatalog);
router.put('/catalog', (req, res, next) => Auth.HasPermission(req, res, next, ['admin_web_catalogs']), CatalogController.updateCatalog);
router.get('/catalog/:id(\\d+)', (req, res, next) => Auth.HasPermission(req, res, next, ['admin_web_catalogs']), CatalogController.viewCatalog);
router.get('/catalog/:id(\\d+)/add', (req, res, next) => Auth.HasPermission(req, res, next, ['admin_web_catalogs']), CatalogController.addProducts);
router.get('/catalog/:id(\\d+)/access_list', (req, res, next) => Auth.HasPermission(req, res, next, ['admin_web_catalogs']), CatalogController.accessList);
router.put('/catalog/client',  CatalogController.clientOperations);
router.get('/catalog/free_search/:id(\\d+)',  CatalogController.freeSearch);



module.exports = router;