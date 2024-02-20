const router = require('express').Router();
const UserController = require('../System/Controllers/UserController');
const Auth = require("../System/Middleware/Auth");

router.get('/profile/:id(\\d+)', UserController.view_profile);
router.post('/updatePreferences', UserController.updatePreferences);
router.post('/update', UserController.updateUser);


router.use((req, res, next) => Auth.HasPermission(req, res, next, ['admin_users']));
//rutas de los usuario
router.get('/', UserController.viewUsers);
router.post('/create', UserController.createUser);
//Rutas de los Roles
router.get('/role', UserController.viewRoles);
router.post('/role/create', UserController.createRole);
router.post('/role/update', UserController.updateRole);
// router.get('/role/:id(\\d+)', UserController.viewRole);
//router.get('/roles', UserController.getRoles);




module.exports = router;