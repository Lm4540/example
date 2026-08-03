const router = require("express").Router();
const Auth = require('../System/Middleware/Auth');


// Home page route.
router.get("/",(req, res, next) => Auth.HasPermission(req, res, next, ['access_to_logistics']), function (req, res) {
    //retornar la vistas de logistica
    res.render('Logistics/index', {pageTitle : 'Logistica'});
});




module.exports = router;