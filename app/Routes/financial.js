const router = require("express").Router();
const Controller = require('../Financial/Controllers/FinancialController');
const Auth = require('../System/Middleware/Auth');

// Home page route.
router.get("/", function (req, res) {
    res.send("A User Admin Page");
});


router.get("/pettycash",
    (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'view_petty_cash', 'admin_all_petty_cash']),
    Controller.pettycash);

router.post("/pettycash",
    (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'admin_all_petty_cash']),
    Controller.addMove);

router.get("/pettycash/:id(\\d+)",
    (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'view_petty_cash', 'admin_all_petty_cash']),
    Controller.viewPettyCash);

router.post("/pettycash/update",
    (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'view_petty_cash', 'admin_all_petty_cash']),
    Controller.updatePettyCash);
router.post("/pettycash/create",
    (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'view_petty_cash', 'admin_all_petty_cash']),
    Controller.createPettyCash);

router.get("/pettycash/printVoucher/:id(\\d+)",
    (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'view_petty_cash', 'admin_all_petty_cash']),
    Controller.printVoucher);




module.exports = router;
