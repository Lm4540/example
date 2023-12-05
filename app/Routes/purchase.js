const PurchaseController = require("../Purchase/Controllers/PurchaseController");
const router = require("express").Router();

router.get("/", function (req, res) {
    return res.render('Purchase/index', {pageTitle : 'Modulo de compras'});
});

router.get('/register', PurchaseController.creation_view);
router.post('/register', PurchaseController.register_purchase);

router.get('/registered', PurchaseController.get_registered_view);
router.get('/get_registered', PurchaseController.get_registered);
router.get('/view/:id(\\d+)', PurchaseController.view_purchase);
router.get('/in', PurchaseController.get_to_in);
router.get('/in/:id(\\d+)', PurchaseController.in_purchase);
router.post('/in', PurchaseController.in_purchase_to_inventory);

router.get('/cost/:id(\\d+)', PurchaseController.cost_purchase);

module.exports = router;