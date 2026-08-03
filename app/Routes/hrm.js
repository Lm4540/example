const router = require("express").Router();
const EmployeeController = require('../HRM/Controllers/EmployeeController');
const Auth = require('../System/Middleware/Auth');
// Home page route.
router.get("/", function (req, res) {res.render('HRM/index.ejs', {pageTitle: 'Human Resources'});});


/**Providers Routes */
router.get('/employee', EmployeeController.getEmployeeView);
router.get('/employee/:id(\\d+)', EmployeeController.viewEmployee);
router.get('/employee/create', EmployeeController.getCreationView);
router.post('/createEmployee', EmployeeController.createEmployee);


module.exports = router;