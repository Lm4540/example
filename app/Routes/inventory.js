const router = require("express").Router();
const ProviderController = require('../Inventory/Controllers/ProvidersController');
const SucursalController = require('../Inventory/Controllers/SucursalController');
const CategoriesController = require('../Inventory/Controllers/CategoriesController');
const ProductController = require('../Inventory/Controllers/ProductController');
const StockController = require('../Inventory/Controllers/StockController');
const Auth = require('../System/Middleware/Auth');
const SaleController = require("../CRM/Controllers/SaleController");


// Home page route.
router.get("/", function (req, res) {
    res.render('Inventory/index.ejs', { pageTitle: 'Modulo de Inventarios' });
});


/**Providers Routes */
router.get('/provider', ProviderController.getProvidersView);
router.get('/providers', ProviderController.searchProvider);
router.get('/provider/create', ProviderController.getCreationView);
router.post('/provider/create', ProviderController.createProvider);
router.get('/provider/view/:id(\\d+)', ProviderController.viewProvider);
router.get('/provider/:id(\\d+)', ProviderController.getProvider);
router.post('/provider/update', ProviderController.updateProvider);
router.get('/product/updateProductforWeb/:id(\\d+)', ProductController.updateProductforWeb);
router.post('/product/updateDamaged', ProductController.updateDamaged);
router.get('/provider/select2', ProviderController.getProviderToSelect2);


/** Sucursal Routes */
router.get('/sucursal', SucursalController.getSucursalsView);
router.post('/sucursal/create', SucursalController.createSucursal);
router.get('/sucursal/:id(\\d+)', SucursalController.getSucursal);
router.get('/sucursal/view/:id(\\d+)', SucursalController.viewSucursal);
router.get('/sucursals', SucursalController.getSucursals);

router.post('/sucursal/update', SucursalController.updateSucursal);/**Pendiente */

/** Clasification routes */
router.get('/productClassifications', CategoriesController.getClassificationsView);
router.post('/productClassifications/create', CategoriesController.createClassification);
router.get('/productClassifications/:id(\\d+)', CategoriesController.getClassification);
router.get('/productClassifications/select2', CategoriesController.getCategoriesToSelect2);
router.post('/productClassifications/update', CategoriesController.updateClassification);/**Pendiente */
router.get('/productClassifications/view/:id(\\d+)', CategoriesController.viewClassification); /** Pendiente */

/** Products Routes */

//router.get('/product/fix_price', ProductController.corregir_precios);
router.get('/product', ProductController.getProductsView);
router.get('/product/create', ProductController.getCreationView);
router.post('/product/create', ProductController.createProduct);
router.get('/products', ProductController.getProductsToTable);
router.get('/products/select2', ProductController.getProductsToSelect2);
router.get('/product/:id(\\d+)', ProductController.getProduct);
router.get('/product/:id(\\d+)/reserveList', StockController.getProductReserveList);
router.get('/product/view/:id(\\d+)', ProductController.viewProduct);
router.get('/product/edit/:id(\\d+)', ProductController.editProduct);
router.post('/product/edit/:id(\\d+)', ProductController.updateProduct);

router.get('/product/kardex/:id(\\d+)', (req, res, next) => Auth.HasPermission(req, res, next, ['view_kardex']), StockController.kardex);//TOKEN
router.get('/product/kardex/:id(\\d+)/details', (req, res, next) => Auth.HasPermission(req, res, next, ['view_kardex']), StockController.kardexDetails);

router.get('/product/move/:id(\\d+)', StockController.move);
router.get('/product/move/:id(\\d+)/details', StockController.moveDetails);
router.get('/product/in/:id(\\d+)', StockController.in);
router.post('/product/in/:id(\\d+)', StockController.SaveIn);
router.get('/product/out/:id(\\d+)', StockController.out);
router.post('/product/out/:id(\\d+)', StockController.SaveOut);
router.get('/product/viewstock', StockController.viewInStock);
router.get('/product/stock', StockController.productInStock);
router.get('/product/divide', StockController.divideProductView);
router.post('/product/divide', StockController.divideProduct);
router.get('/product/join', StockController.joinProductView);
router.post('/product/join', StockController.joinProduct);

router.get('/product/recount', StockController.getRecountView);
router.post('/product/recount', StockController.createNewRecount);
router.get('/product/recount/:id(\\d+)', StockController.viewRecount);
router.get('/product/recount/:id(\\d+)/:product(\\d+)', StockController.productInArea);
router.post('/product/recount/area', StockController.addAreas);
router.get('/product/recountArea/:id(\\d+)', StockController.viewArea);
router.post('/product/recountArea', StockController.addDetailToArea);
router.post('/product/recount/update', StockController.updateRecount);
router.post('/product/recount/clean', StockController.cleanRecount);


router.get('/product/stock_report', StockController.general_report);
router.get('/product/stock_report/detailed', StockController.reporte_detallado);
router.get('/product/stock_report/dates', StockController.inventory_report_per_dates);
router.get('/product/stock_report/get_details', StockController.inventory_retpor_details);
router.get('/product/archive/:id(\\d+)', ProductController.archive);
// router.get('/product/updateClassification', ProductController.getVistadeCorreccionDeClassificaciones);
router.get('/product/ProductosACorregir', ProductController.obtenerProductosACorregir);
router.post('/product/updateClassification', ProductController.corregirClassificacion);




router.get('/reserveList', StockController.reserveList);
router.get('/productReserveList', StockController.ProductreserveList);

router.get('/requisition', StockController.viewRequisitions);
router.get('/requisition/:id(\\d+)', StockController.viewRequisition);
router.get('/requisition/:id(\\d+)/my', StockController.viewRequisition_MyProducts);
router.post('/requisition', StockController.updateRequisition);
router.post('/requisition/proccess', StockController.proccessRequisition);
router.post('/requisition/addToClient', SaleController.add_detail_from_request_tranfer);




router.get('/shipment', StockController.viewShipments);
router.get('/shipment/:id(\\d+)', StockController.viewShipment);
router.get('/shipment/print/:id(\\d+)', StockController.printShipment);
router.get('/shipment/new', (req, res, next) => Auth.HasPermission(req, res, next, ['trasnfer_between_warehouses', 'trasnfer_between_all_warehouses']), StockController.newShipment);
router.post('/shipment/new', (req, res, next) => Auth.HasPermission(req, res, next, ['trasnfer_between_warehouses', 'trasnfer_between_all_warehouses']), StockController.saveShipment);

router.get('/shipment/in/:id(\\d+)', (req, res, next) => Auth.HasPermission(req, res, next, ['receive_transfered_product', 'trasnfer_between_all_warehouses']), StockController.inShipment);
router.post('/shipment/in', (req, res, next) => Auth.HasPermission(req, res, next, ['receive_transfered_product', 'trasnfer_between_all_warehouses']), StockController.inShipment);
router.get('/reserve/list', (req, res, next) => Auth.HasPermission(req, res, next, ['view_reserve_list']), StockController.reserveList);

router.get('/product/test', (req, res) => {
    /*const bcrypt = require('bcryptjs');
    res.send('this shit');
    const saltrounds = Number.parseInt(process.env.PASSWORD_DEFULT_COST);
    const plainPassword = 'myPassword123';

    const encrypted = bcrypt.hashSync(plainPassword, saltrounds);
    console.log('hash en la app', encrypted);
    const palabraSecretaValida = bcrypt.compareSync(plainPassword, encrypted);
    console.log(palabraSecretaValida);*/
    return res.json({
        'message': 'nada por aca'
    })
}); //pendiente

router.get('/test/test', ProductController.testTest2);
/** Stock & Movements Routes */

/** Reports Routes */

module.exports = router;