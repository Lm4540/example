const router = require("express").Router();



// Home page route.
router.get("/", function (req, res) {
    //retornar la vistas de logistica
    res.render('Logistics/index', {pageTitle : 'Logistica'});
});




module.exports = router;