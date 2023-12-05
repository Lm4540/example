const Employee = require('../Models/Employee');
const User = require('../../System/Models/User');
const EmployeeRecord = require('../Models/EmployeeRecord');
const Sucursal = require('../../Inventory/Models/Sucursal');

const Helper = require('../../System/Helpers');
const Money = require('../../System/Money');
const sequelize = require("../../DataBase/DataBase");
const { Op, QueryTypes } = require("sequelize");
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const hashPassword = plainPassword => bcrypt.hashSync(plainPassword, Number.parseInt(process.env.PASSWORD_DEFULT_COST));

const EmployeeController = {
    getCreationView: async (req, res, next) => {
        let sql = 'SELECT * FROM `system_user` WHERE id not in (SELECT _user FROM `hrm_employee` WHERE _user is not null)';
        let users = await sequelize.query(sql, { type: QueryTypes.SELECT, model: User, });
        let sucursal = await Sucursal.findAll({attributes: ['name', 'id'], raw: true});
        return res.render('HRM/Employee/create', { pageTitle: 'Nuevo Empleado', users, sucursal });
    },
    createEmployee: async (req, res, next) => {
        let data = req.body;
        let message = null;

        if (data.name.length < 2) {
            return res.json({
                status: 'errorMessage',
                message: 'Por favor, proporcione el nombre del empleado',
            });
        } else if (!Helper.isValidEmail(data.email)) {
            return res.json({
                status: 'errorMessage',
                message: 'no ha proporcionado un email válido'
            });
        } else if (data.phone.length < 8) {
            return res.json({
                status: 'errorMessage',
                message: 'Proporcione el numero de contacto del Empleado'
            });

        }

        //validar que el nombre no este registrado
        let occurency = await Employee.findOne({
            where: { [Op.or]: [{ name: data.name }, { phone: data.phone }, { email: data.email }], }
        }).catch(e => {return next(e)});

        if (occurency !== null) {
            return res.json({
                status: 'errorMessage',
                message: occurency.name == data.name
                    ? 'Ya hay un Empleado registrado con este nombre'
                    : (occurency.phone == data.phone
                        ? 'Ya hay un empleado registrado con este numero de contacto'
                        : 'Ya hay un Empleado registrado con este email')
            });
        }
        /**Guardar la imagen si es que ha sido enviada */
        let image_name = null;
        if (data.image.length > 1) {
            image_name = 'employe_' + Helper.generateNameForUploadedFile() + '.jpg';
            let location = path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images', image_name);
            // obtener la data de la imagen sin el inicio 'data:image/jpeg;base64,'
            let image_data = data.image.slice(23);
            //Almacenar la imagen
            fs.writeFile(location, image_data, 'base64', (err) =>{
                if(err){
                    console.log(err)
                }
            });
        }

        try {
            const result = await sequelize.transaction(async (t) => {
                let user_id = null;

                if (data.user == 'regiser') {
                    //crear el usuario
                    let user = await User.create({
                        role: 2,
                        email: data.email,
                        name: data.name,
                        password: hashPassword(process.env.USER_PASSWORD_DEFAULT),
                        attempts: 5,
                        createdBy: req.session.userSession.shortName,
                    }, { transaction: t });

                    user_id = user.id;
                } else if (data.user == 'none') {
                    user_id = null;
                } else {
                    user_id = data.user;
                }

                let employee = await Employee.create({
                    name: data.name,
                    isSeller: data.isSeller,
                    createdBy: req.session.userSession.shortName,
                    phone: data.phone,
                    email: data.email,
                    direction: data.direction,
                    balance: 0.00,
                    NIT_DUI: data.dui,
                    _user: user_id,
                    image: image_name,
                    sucursal: data.sucursal
                }, { transaction: t });

                return res.json({
                    status: 'success',
                    data: employee,
                });
            });
        } catch (err) {
            console.log(err);
            // next(err);
        }

    },
    getEmployeeView: async (req, res, next) => {
        let data = await Employee.findAll({ attributes: ['id', 'name', '_user', 'email'] }).catch(err => next(err));
        return res.render('HRM/Employee/index', { pageTitle: 'Empleados', employees: data });
    },
    /*searchEmployee: async (req, res) => {
        let params = req.query;
        var query_options = {};

        //Si hay terminos de busqueda, lo agregamos a la SQL
        if (params.search !== undefined && params.search.length > 3) {
            query_options.where = {
                [Op.or]: [
                    { name: { [Op.substring]: params.search } },
                    { NRC: { [Op.substring]: params.search } },
                    { phone: { [Op.substring]: params.search } },
                    { NIT_DUI: { [Op.substring]: params.search } },
                    { email: { [Op.substring]: params.search } },
                ]
            }
        }

        //Si Hay parametros de Ordenamiento
        if (params.order !== undefined) {
            query_options.order = [[params.order, params.dir],];
        } else {
            query_options.order = [['id', 'ASC'],];
        }
        try {
            let result = {
                params: params,
            };
            result.total_rows = query_options;
            result.total_rows.col = 'id';
            result.total_rows = await Provider.count(result.total_rows);

            query_options.offset = parseInt(params.offset);
            query_options.limit = parseInt(params.limit);
            result.data = await Provider.findAll(query_options);

            //Formatear y regresar el arreglo
            return res.json(result);
        } catch (error) {
            return res.status(500).json({ 'error': 'Internal Server Error' });
        }

    },

    
    viewEmployee: async (req, res) => {

    },
    updateEmployee: async (req, res) => {
        
    },

    */
};

module.exports = EmployeeController;