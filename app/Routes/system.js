const router = require("express").Router();
const UtilsController = require("../System/Controllers/utilsController");

// Home page route.
router.get("/icons", function (req, res) {
    
    res.render("Common/Icons.ejs", {pageTitle: 'Icons Example'});
});

router.get("/tools", function (req, res) {
    
    res.render("Common/Icons.ejs", {pageTitle: 'Icons Example'});
});

router.get('/revision', UtilsController.revision_de_totales);


module.exports = router;