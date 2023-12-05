const router = require("express").Router();
// Home page route.
router.get("/icons", function (req, res) {
    
    res.render("Common/Icons.ejs", {pageTitle: 'Icons Example'});
});


module.exports = router;