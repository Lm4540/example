const Role = require('../Models/Role');
const User = require('../Models/User');
const Helper = require('../../System/Helpers');
// const sequelize = require("../../DataBase/DataBase");
const { Op, QueryTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");
const bcrypt = require('bcryptjs');
const PermissionList = require('../PermissionList');

const hashPassword = plainPassword => bcrypt.hashSync(plainPassword, Number.parseInt(process.env.PASSWORD_DEFULT_COST));
const verifyPassword = (plainPassword, encrypted) => bcrypt.compareSync(plainPassword, encrypted);
const UserController = {
    view_profile: async (req, res) => {

        let user = await User.findByPk(req.params.id);
        if (user){
            return res.render('System/User/profile', { pageTitle: user.name, user});

        }
        return Helper.notFound(req, res, 'User not Found');
    },

    viewUsers: async (req, res) => {
        let users = await User.findAll({ order: [['name', 'asc']] });
        let rols = await Role.findAll({ order: [['name', 'asc']], attributes: ['id', 'name', 'permission'] });
        let indexed_rols = {}
        let indexed_users = {}
        rols.forEach(rol => {
            indexed_rols[rol.id] = {
                id: rol.id,
                name: rol.name,
                permission: rol.permission,
            }
        });

        users.forEach(user => {
            indexed_users[user.id] = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                permission: indexed_rols[user.role].permission,
                specialPermission: user.specialPermission,
                temporalPermission: user.temporalPermission,
                temporalDate: user.temporalDate
            }
        });

        let indexed_permissions = {};
        PermissionList.forEach(per => { indexed_permissions[per.permission] = per.name; });
        return res.render('System/User/view', { pageTitle: 'Usuarios Registrados', users, rols, PermissionList, indexed_users, indexed_permissions });
    },
    createUser: async (req, res) => {

        //validar los datos
        let name = req.body.name;
        let email = req.body.email;

        if (name < 5) {
            return res.json({ status: 'errorMessage', message: 'Coloque el nombre del Usuario' });
        } else if (!Helper.isValidEmail(email)) {
            return res.json({ status: 'errorMessage', message: 'Coloque un correo Electrónico válido' });
        }

        //buscar el role
        let role = await Role.findByPk(req.body.role);
        if (role == null) {
            return res.json({ status: 'errorMessage', message: 'El Rol seleccionado no existe', });
        } else if (role.status == 'off') {
            return res.json({ status: 'errorMessage', message: 'El Rol seleccionado no existe, está desactivado, elija otro Rol', });
        }

        //verificar el nombre y el email del usuario a crear
        let existe = await User.count({
            where: {
                [Op.or]: [{ 'name': name }, { 'email': email }]
            }
        });

        if (existe > 0) {
            return res.json({ status: 'errorMessage', message: 'Ya existe un usuario con este nombre o correo Electronico', });
        }

        try {
            //encriptar la clave
            let password = hashPassword(process.env.USER_PASSWORD_DEFAULT);

            //guardar los datos
            let user = await User.create({
                role: role.id,
                email,
                name,
                password,
                attempts: 5,
                createdBy: req.session.userSession.shortName,
                specialPermission: null,
                temporalPermission: null,
                preferences: { darkmode: '', VoiceEnabled: true, }
            });

            //responder con el objeto creado
            return res.json({
                status: 'success',
                data: user,
            });

        } catch (error) {
            console.log(error)
            return res.status(500).json({ status: 'errorMessage', message: 'Error', });
        }
    },

    updateUser: async (req, res) => {
        let user = await User.findByPk(req.body.user);
        if (user == null) {
            return res.json({ status: 'errorMessage', message: 'User not Found', });
        }
        switch (req.body.option) {
            case 'block':
                if (user._status == 'role_off') {
                    return res.json({ status: 'errorMessage', message: 'El Rol asignado a este usuario esta inhabilitado, por favor asigne otro rol para poder desbloquearlo', });
                } else if (user._status == 'blocked' || user._status == 'off') {
                    user._status = 'on';
                    user.attempts = 5;
                } else if (user._status == 'on') {
                    user._status = 'off';
                }
                break;
            case 'resetpasword':
                user.password = hashPassword(process.env.USER_PASSWORD_DEFAULT);
                break;

            case 'data':
                user.name = req.body.name;
                user.role = req.body.role;
                user.email = req.body.email;
                break;

            case 'special':
                user.specialPermission = req.body.permission;
                break;

            case 'temporal':
                user.temporalPermission = req.body.permission;
                user.temporalDate = req.body.date;
                break;

            case 'password':
                //verificaciones
                //verificar que las contraseñas coincidan
                console.log(!verifyPassword(req.body.old_pass, user.password), req.body.old_pass, user.password)
                if(req.body.new_pass.length < 8){
                    return res.json({ status: 'errorMessage', message: 'La nueva contraseña debe tener al menos 8 caracteres', });
                    
                }else if(!verifyPassword(req.body.old_pass, user.password)){
                    return res.json({ status: 'errorMessage', message: 'La contraseña anterior es incorrecta', });
                }
                //verificar la vieja contraseña


                user.password = hashPassword(req.body.new_pass);
                break;

            default:

                break;
        }

        await user.save();
        let role = await Role.findByPk(user.role);
        let _user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            permission: role.permission,
            specialPermission: user.specialPermission,
            temporalPermission: user.temporalPermission,
            temporalDate: user.temporalDate
        }

        //cerrar la session de los usuarios que tengan ese 

        await sequelize.query(
                'DELETE FROM system_sessions WHERE user_id = :user_id',
                {
                    replacements: { user_id:  user.id },
                    type: QueryTypes.DELETE
                });

        return res.json({
            status: 'success',
            data: _user,
        });
    },

    updatePreferences: async (req, res) => {
        let user = await User.findByPk(req.session.userSession.id);
        if (user == null) {
            return res.json({ status: 'errorMessage', message: 'User not Found', });
        }
        let preferences = user.preferences;
        switch (req.body.case) {
            case 'darkMode':
                if (preferences.darkmode !== undefined) {
                    preferences.darkmode = preferences.darkmode == '' ? 'dark' : '';
                } else {
                    preferences.darkmode = 'dark';
                }
                break;
        }


        user.preferences = preferences;
        await user.save();
        
        req.session.userSession.preferences = preferences;
        req.session.save();

        return res.json({
            status: 'success', message: 'Guardado'
        });
    },


    /** Controles para los roles */
    viewRoles: async (req, res) => {
        //buscar los roles Existentes
        let rols = await Role.findAll({ attributes: ['id', 'name', 'permission'] });
        let indexed_rol = {};
        rols.forEach(element => {
            indexed_rol[element.id] = {
                name: element.name,
                users: [],
                permission: element.permission
            }
        });
        let users = await User.findAll({ attributes: ['id', 'name', 'email', 'role'] });
        users.forEach(element => {
            indexed_rol[element.role].users.push(element);
        });

        let indexed_permissions = {};
        PermissionList.forEach(per => { indexed_permissions[per.permission] = per.name; });

        res.render('System/Role/all', { pageTitle: 'Roles de usuario', rols, PermissionList, indexed_permissions, indexed_rol });
    },
    createRole: async (req, res) => {
        let name = req.body.name;
        let description = req.body.description;

        if (name.length < 3) {
            return res.json({ status: 'errorMessage', message: 'Proporcione un nombre para el Rol', });
        } else if (description.length < 10) {
            return res.json({ status: 'errorMessage', message: 'Proporcione una descripcion de 10 a 300 caracteres de longitud', });
        }
        let role = await Role.create({
            name,
            description,
            updatedBy: null,
            createdBy: req.session.userSession.name,
            permission: null,
        });

        return res.json({
            status: 'success',
            data: role.id,
        });
    },


    updateRole: async (req, res) => {
        let role = await Role.findByPk(req.body.role);
        let permissions = req.body.permissions;

        if (role == null) {
            return res.json({ status: 'errorMessage', message: 'Role not Found', });
        }

        role.permission = permissions;
        await role.save();

        //cerrar las sessiones de los usuarios que pertenezcan a ese ROl
        await sequelize.query(
            'DELETE FROM system_sessions WHERE user_id in (SELECT id FROM `system_user` WHERE role = :role_id and id != :user_id)',
            {
                replacements: { role_id: role.id, user_id: req.session.userSession.id },
                type: QueryTypes.DELETE
            });

        return res.json({
            status: 'success',
            data: role,
        });


    },
    /*
    getRoles: async (req, res) => {
        let tmp = await Role.findAll();
        let rol = {};
        tmp.forEach(element => {
            rol[element.id] = {
                name: element.name,
                users: [],
                permission: element.permission
            }
        });
        let users = await User.findAll({ attributes: ['id', 'name', 'email', 'role'] });
        users.forEach(element => {
            rol[element.role].users.push(element);
        });
        return res.json({ rol, PermissionList });
    },
    viewRole: async (req, res) => {
        let rol = await Role.findByPk(req.params.id);
        return res.render('System/Role/view', { pageTitle: rol.name, rol });
    },
    */


};

module.exports = UserController;


