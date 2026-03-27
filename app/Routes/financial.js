const router = require("express").Router();
const PettyCashController = require('../Financial/Controllers/PettyCashController');
const FinancialController = require('../Financial/Controllers/FinancialController');
const Auth = require('../System/Middleware/Auth');

// Home page route.
router.get("/", FinancialController.main);
router.get('/payables', FinancialController.listPayableAccounts);
router.get('/history', FinancialController.getPaidAccountsHistory);
router.get('/provider/:id', FinancialController.getProviderHistory);
router.get('/account/:id', FinancialController.getAccountDetail);
router.get('/received-payments', FinancialController.getPaymentReceivedReport);

// --- RUTAS DE API (JSON) ---
router.get('/api/pending-accounts/:providerId', FinancialController.getPendingByProvider);
router.post('/api/create-account', FinancialController.createAccount);
router.post('/api/process-payment', FinancialController.processProviderPayment);

router.get('/arqueo/:id', (req, res, next) => Auth.HasPermission(req, res, next, ['create_petty_cash_clossing']), PettyCashController.getArqueoView);
router.post('/arqueo', (req, res, next) => Auth.HasPermission(req, res, next, ['create_petty_cash_clossing']), PettyCashController.createArqueo);
router.post('/api/verify-arqueo', (req, res, next) => Auth.HasPermission(req, res, next, ['verify_petty_cash_clossing']), PettyCashController.verifyArqueo);
router.get('/view-arqueos', (req, res, next) => Auth.HasPermission(req, res, next, ['view_petty_cash_clossing']), PettyCashController.viewArqueos);
router.get('/view-arqueos/:id(\\d+)', (req, res, next) => Auth.HasPermission(req, res, next, ['view_petty_cash_clossing']), PettyCashController.viewArqueo);



router.get("/pettycash", (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'view_petty_cash', 'admin_all_petty_cash']), PettyCashController.pettycash);
router.post("/pettycash", (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'admin_all_petty_cash']), PettyCashController.addMove);
router.get("/pettycash/:id(\\d+)", (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'view_petty_cash', 'admin_all_petty_cash']), PettyCashController.viewPettyCash);
router.post("/pettycash/update", (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'view_petty_cash', 'admin_all_petty_cash']), PettyCashController.updatePettyCash);
router.post("/pettycash/create", (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'view_petty_cash', 'admin_all_petty_cash']), PettyCashController.createPettyCash);
router.get("/pettycash/printVoucher/:id(\\d+)", (req, res, next) => Auth.HasPermission(req, res, next, ['admin_petty_cash', 'view_petty_cash', 'admin_all_petty_cash']), PettyCashController.printVoucher);

router.post("/pettycash/consignar", (req, res, next) => Auth.HasPermission(req, res, next, ['consignar_saldo_en_caja']), PettyCashController.ConsignarSaldo);
router.get("/pettycash/consignar-historial/:id(\\d+)", (req, res, next) => Auth.HasPermission(req, res, next, ['consignar_saldo_en_caja']), PettyCashController.GetConsignedHistory);
router.get("/pettycash/clear-consignar-historial/:id(\\d+)", (req, res, next) => Auth.HasPermission(req, res, next, ['consignar_saldo_en_caja']), PettyCashController.ClearConsignedHistory);

router.get("/saldos_a_favor", PettyCashController.saldos_a_favor);

module.exports = router;
