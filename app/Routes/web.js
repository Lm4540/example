const router = require("express").Router();
const CatalogController = require("../Web/Controllers/CatalogController");

// Home page route.
router.get("/", function (req, res) {
      res.render('Web/index.ejs', { pageTitle: 'Herramientas para la Web' });
});

router.get('/catalogs', CatalogController.allCatalog);
router.get('/catalog', CatalogController.getCatalogs);
router.post('/catalog', CatalogController.createCatalog);
router.put('/catalog', CatalogController.updateCatalog);
router.get('/catalog/:id(\\d+)', CatalogController.viewCatalog);
router.get('/catalog/:id(\\d+)/add', CatalogController.addProducts);
router.get('/catalog/:id(\\d+)/access_list', CatalogController.accessList);
router.put('/catalog/client', CatalogController.clientOperations);


module.exports = router;