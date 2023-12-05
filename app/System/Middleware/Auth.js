const Employee = require('../../HRM/Models/Employee');
const Role = require('../Models/Role');
const User = require('../Models/User');
const bcrypt = require('bcryptjs');
const sequelize = require("../../DataBase/DataBase");
const { QueryTypes } = require('sequelize');
const verifyPassword = (plainPassword, encrypted) => bcrypt.compareSync(plainPassword, encrypted);

const Auth = {
    Authenticated: (req, res, next,) => {
        //Verificar si existe una session
        if (req.session.userSession !== undefined && req.session.userSession !== null) {
            res.locals.user = {
                id: req.session.userSession.id,
                name: req.session.userSession.shortName,
                preferences: req.session.userSession.preferences,
                sucursal:  req.session.userSession.employee.sucursal,
            }
            res.locals.darkMode = req.session.userSession.preferences.darkmode != undefined ? req.session.userSession.preferences.darkmode : '';
            res.locals.permission = req.session.userSession.permission;
            return next();
        }
        return req.method == 'GET' ? res.render('Common/Login') : res.status(401).json({
            error: 401,
            message: '401 Unauthorized',
            status: 'error'
        })
    },
    Authorized: (req, res, next, permission) => {

        return req.session.userSession.permission.includes(permission)
            ? next() : (req.xhr
                ? res.render('Common/403')
                : res.status(403).json({ error: 403, message: '403 Forbidden', status: 'error' }));
    },

    HasPermission: (req, res, next, permission) => {
        let has_permission = false;
        permission.forEach(element => {
            if(has_permission == false){
                has_permission = req.session.userSession.permission.includes(element);
            }
        });

        return has_permission
            ? next() : (req.xhr
                ? res.status(403).json({ error: 403, message: '403 Forbidden', status: 'error' })
                : res.render('Common/403'));
    },

    Login: async (req, res) => {
        //buscar el Usuario
        let user = await User.findOne({
            where: {
                email: req.body.username,
            }
        });

        if (user === null) {
            return res.json({
                status: 'errorMessage',
                message: 'Credenciales de Acceso no válidas'
            });
        } else if (user.attempts < 1 || user._status == 'blocked') {
            return res.json({
                status: 'errorMessage',
                message: 'Usuario Bloqueado'
            });
        } else if (user._status == 'off') {
            return res.json({
                status: 'errorMessage',
                message: 'Usuario Desactivado'
            });
        } else if (user._status == 'role_off') {
            return res.json({
                status: 'errorMessage',
                message: 'No se puede Acceder en este momento, por favor pida a un administrador que revise sus permisos de usuario',
            });
        } else if (!verifyPassword(req.body.password, user.password)) {
            //reducir los intentos
            user.attempts = user.attempts - 1;
            if (user.attempts == 0) {
                user._status = 'blocked'
            }
            await user.save();

            return res.json({
                status: 'errorMessage',
                message: 'Credenciales de Acceso no válidas'
            });
        }
        //buscar el Rol
        let rol = await Role.findByPk(user.role);
        if (rol == null) {
            return res.json({
                status: 'errorMessage',
                message: 'No se puede Acceder en este momento, por favor pida a un administrador que revise sus permisos de usuario',
            });
        }

        //obtener los permisos
        let permission = [];
        //verififcar la fecha de los permisos Temporales
        if(user.temporalPermission.length > 0){
            if(new Date(user.temporalDate).getTime() > new Date().getTime()){
                permission = user.temporalPermission;
            }
        }

        permission = permission.concat(rol.permission, user.specialPermission);

        if (permission.length < 1) {
            return res.json({
                status: 'errorMessage',
                message: 'No se puede Acceder en este momento, por favor pida a un administrador que revise sus permisos de usuario',
            });
        }

        user.attempts = 5;
        await user.save();
        // remember,

        let user_ = {
            id: user.id,
            name: user.name,
            permission,
            remember: false,
            preferences: user.preferences,
            employee: await Employee.findOne({ where: { _user: user.id } }),
        }

        var hour = 3600000;
        if (req.body.remember == true) {
            user_.remember = true;
            hour = hour * 3 * 24;
        }


        let name = user.name.split(' ');
        user_.shortName = name.length == 4 ? `${name[0]} ${name[2]}` : user.name;

        req.session.cookie.expires = new Date(Date.now() + hour)
        req.session.cookie.maxAge = hour;
        req.session.cookie.sameSite = true;
        req.session.userSession = user_;

        //sucursal del usuario
        // req.session.userSession.employee.sucursal
        // req.session.userSession.shortName


        //actualizar el dato adicional de la session
        req.session.save(err => err ? console.log(err) : '');


        return res.json({
            status: 'success',
            message: `Hola ${user_.shortName}!, bienvenido!`,
        });
    },

    LogOut: async (req, res, next) => {
        req.session.destroy(err => {
            if (err) { console.log(err) }
            res.redirect('/');
        });
    },

    renewSession: async (req, res, next) => {
        next();
    },

    setUserSessionRegister: async (req, res, next) => {
        await sequelize.query(
            "UPDATE `system_sessions` SET `user_id` = ? WHERE `session_id` = ? ", {
            replacements: [req.session.userSession.id, req.session.id],
            type: QueryTypes.UPDATE
        }).catch(e => console.log(e));

        return res.json({
            status: 'success',
        });
    },

    deleteSession: async (_option, _value) => {
        let sql = '';
        let replacements = [_value];
        switch (_option) {
            case 'user':
                sql = "DELETE FROM `system_sessions` WHERE user_id = ?";
                break;
            case 'role':
                sql = "DELETE FROM `system_sessions` WHERE user_id in(SELECT id FROM `system_user` WHERE role = ?)";
                break;
            default:
                break;
        }
        return await sequelize.query(
            sql, {
            replacements,
            type: QueryTypes.DELETE
        }).catch(e => console.log(e));

       
    },

    socketAuth: async (socket, next) => {
        const session = socket.request.session;
        if (session.userSession !== undefined && session.userSession !== null) {
            next();
        } else {
            next(new Error("unauthorized"));
        }
    },
}

module.exports = Auth;