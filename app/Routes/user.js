const router = require('express').Router();
const UserController = require('../System/Controllers/UserController');

router.use(function timeLog(req, res, next) {
    console.log('Time: ', Date.now());
    next();
});

//rutas de los usuario
router.get('/', UserController.viewUsers);
router.post('/create', UserController.createUser);
router.post('/update', UserController.updateUser);
router.get('/profile/:id(\\d+)', UserController.view_profile);
router.post('/updatePreferences', UserController.updatePreferences);


//Rutas de los Roles
router.get('/role', UserController.viewRoles);
router.post('/role/create', UserController.createRole);
router.post('/role/update', UserController.updateRole);



// router.get('/role/:id(\\d+)', UserController.viewRole);
//router.get('/roles', UserController.getRoles);




module.exports = router;