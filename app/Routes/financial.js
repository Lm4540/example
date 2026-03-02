const router = require("express").Router();
const PettyCashController = require('../Financial/Controllers/PettyCashController');
const Auth = require('../System/Middleware/Auth');

// Home page route.
router.get("/", function (req, res) {
    res.send("A User Admin Page");
});


router.get("/pettycash",
    (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'view_petty_cash', 'admin_all_petty_cash']),
    PettyCashController.pettycash);

router.post("/pettycash",
    (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'admin_all_petty_cash']),
    PettyCashController.addMove);

router.get("/pettycash/:id(\\d+)",
    (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'view_petty_cash', 'admin_all_petty_cash']),
    PettyCashController.viewPettyCash);

router.post("/pettycash/update",
    (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'view_petty_cash', 'admin_all_petty_cash']),
    PettyCashController.updatePettyCash);
router.post("/pettycash/create",
    (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'view_petty_cash', 'admin_all_petty_cash']),
    PettyCashController.createPettyCash);

router.get("/pettycash/printVoucher/:id(\\d+)",
    (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'view_petty_cash', 'admin_all_petty_cash']),
    PettyCashController.printVoucher);

router.get("/saldos_a_favor",  PettyCashController.saldos_a_favor);


module.exports = router;
