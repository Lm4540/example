const router = require("express").Router();
const EmployeeController = require('../HRM/Controllers/EmployeeController');

// Home page route.
router.get("/", function (req, res) {res.render('HRM/index.ejs', {pageTitle: 'Human Resources'});});


/**Providers Routes */
router.get('/employee', EmployeeController.getEmployeeView);
router.get('/employee/create', EmployeeController.getCreationView);
router.post('/createEmployee', EmployeeController.createEmployee);
// router.get('/employee/:id(\\d+)', EmployeeController.EmployeeView);

/*
router.post('/client/update', EmployeeController.updateClient);
router.get('/client/:id(\\d+)', EmployeeController.getClient);
router.get('/client/:id(\\d+)/orders', EmployeeController.getClientOrders);
router.get('/client/view/:id(\\d+)', EmployeeController.viewClient);
router.get('/client/select2', EmployeeController.getClientToSelect2);
*/

module.exports = router;