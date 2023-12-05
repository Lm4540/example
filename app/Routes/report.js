const router = require("express").Router();
// Home page route.
router.get("/", function (req, res) {
    res.send("A User Admin Page");
});

// About page route.
router.post("/", function (req, res) {
    res.send("Save a User");
});

router.put("/", function (req, res) {
    res.send("update a user");
});

router.delete("/", function (req, res) {
    res.send("delete a user");
});


router.post("/reset_pass", function (req, res) {
    res.send("reset paswword by admin");
});

router.post("/update-password", function (req, res) {
    res.send("update password by user");
});

router.get("/login", function (req, res) {
    res.send("login page");
});

router.post("/login", function (req, res) {
    res.send("login function");
});


router.post("/login", function (req, res) {
    res.send("login out");

    // buscar el token que tiene asignada esta session
    // dar de baja el token
});

router.post("/close_session", function (req, res) {
    res.send("login out");

    // buscar el token que tiene asignada la session en cuestion
    // dar de baja el token
});

router.post("/close_all_session", function (req, res) {
    res.send("login out");

    // buscar todos los tokens activos del usuario y darlos de baja excepto el token de la session actual
});

module.exports = router;