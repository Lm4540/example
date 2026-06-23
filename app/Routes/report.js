const router = require("express").Router();
const Auth = require('../System/Middleware/Auth');
// Home page route.
router.get("/", function (req, res) {
    res.send("A User Admin Page");
});



module.exports = router;