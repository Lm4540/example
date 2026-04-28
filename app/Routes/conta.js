const router = require("express").Router();
const ReportController = require("../Accounting/Controllers/ReportController");

/**Providers Routes */
router.get('/', ReportController.dashboard);
router.get('/sales_book', ReportController.salesBook);
router.get('/sales_book_data', ReportController.salesBookData);
router.get('/dte_cost', ReportController.dte_cost);
router.post('/dte_cost_data', ReportController.dte_cost_data);

router.get('/generated_dte', ReportController.dte_report);


module.exports = router;