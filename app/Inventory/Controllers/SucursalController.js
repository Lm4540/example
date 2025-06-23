const Sucursal = require('../Models/Sucursal');
const Helper = require('../../System/Helpers');
const { Op, QueryTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");
const Sale = require('../../CRM/Models/Sale');
const Product = require('../Models/Product');
const CajaChica = require('../../Financial/Models/PettyCash');
const tipoEstablecieminto = require('../../DTE/Catalogos/CAT-009.json').items;

let tipoEstablecieminto_ = {};
tipoEstablecieminto.forEach(element => {
    tipoEstablecieminto_[element.codigo] = element.Valor;
});




const SucursalController = {

    createSucursal: async (req, res) => {
        let data = req.body;
        let message = null;

        if (data.name === '' || data.name === null || data.name.length < 3) {
            res.json({
                status: 'Por favor Proporcione un nombre para la nueva Sucursal',
                message: message,
            });
        } else if (data.clientDirection === '' || data.clientDirection === null || data.clientDirection.length < 3) {
            res.json({
                status: 'Por favor Proporcione la direccion de la sucursal',
                message: message,
            });
        } else if (data.distrito == "" || data.distrito == "00") {
            res.json({
                status: 'Por favor Seleccione el Distrito',
                message: message,
            });
        } else if (data.municipio == "" || data.municipio == "00") {
            res.json({
                status: 'Por favor Seleccione el Municipio',
                message: message,
            });
        } else if (data.departamento == "" || data.departamento == "00") {
            res.json({
                status: 'Por favor Seleccione el Tipo de Establecimiento',
                message: message,
            });
        } else if (data.abreviation == "" || data.abreviation == null) {
            res.json({
                status: 'Por favor Escriba la abreviación del Establecimiento',
                message: message,
            });
        } else {

            let sucursal = await Sucursal.findOne({ where: { name: data.name } });
            if (sucursal) {
                res.json({
                    status: 'success',
                    data: sucursal.id,
                });
            } else {
                try {
                    sucursal = await Sucursal.create({
                        name: data.name,
                        location: data.distrito + ", " + data.clientDirection,
                        abreviation: data.abreviation,
                        departamento: data.departamento,
                        municipio: data.municipio,
                        tipoEstablecimiento: data.tipoEstablecieminto,
                        codEstableMH: data.CodeMh,
                        codEstable: data.CodeEstable,
                    });

                    // crear la caja chica

                    let caja = await CajaChica.create({
                        name: data.name + ' - Caja 01',
                        sucursal: sucursal.id,
                        balance: 0.00,
                    });

                    res.json({
                        status: 'success',
                        data: sucursal.id,
                    });
                } catch (error) {
                    res.status(500).json({
                        status: 'error',
                        message: error.message,
                    });
                }
            }


        }




    },
    getSucursalsView: async (req, res) => {
        //buscar todas las sucursales

        let sucursals = await Sucursal.findAll({
            attributes: ['name', 'location', 'mapLink', 'id']
        });

        let municipios = require('../../DTE/Catalogos/CAT-013.json').items;
        let departamentos = require('../../DTE/Catalogos/CAT-012.json').items;
        let dptos = JSON.stringify(require('../../DTE/Catalogos/direction.json'));
        let dis = JSON.stringify(require('../../DTE/Catalogos/distritos_.json'));
        res.render('Inventory/Sucursal/sucursals', { pageTitle: 'Sucursales Registradas', sucursals, tipoEstablecieminto, municipios, departamentos, dptos, dis });
    },

    getSucursal: async (req, res) => {

        let sucursal = await Sucursal.findByPk(req.params.id);
        if (sucursal === null) {
            return res.status(404);
        }
        res.json({
            sucursal,
        });
    },

    viewSucursal: async (req, res) => {
        let sucursal = await Sucursal.findByPk(req.params.id);
        if (sucursal === null) {
            return res.status(404);
        }

        let sales = await Sale.findAll({
            where: {
                [Op.and]: [
                    { _status: { [Op.in]: ['process', 'prepared', 'transport', 'closed'] } },
                    { sucursal: sucursal.id },
                ],
            }
        });

        let clients = await sequelize.query(
            'select id, name from crm_client where sucursal = :sucursal or id in (select client from crm_sale where sucursal = :sucursal)',
            {
                replacements: { sucursal: sucursal.id },
                type: QueryTypes.SELECT,
            }
        );
        clients['indexes'] = {};
        let ClientsLen = clients.length;
        clients.forEach(element => {
            clients.indexes[element.id] = element.name;
        });

        let sellers = await sequelize.query(
            'select id, name from hrm_employee where sucursal = :sucursal and isSeller = 1',
            {
                replacements: { sucursal: sucursal.id },
                type: QueryTypes.SELECT,
            }
        );
        sellers.indexes = {};
        let SellersLen = sellers.length;

        sellers.forEach(element => {
            sellers.indexes[element.id] = element.name;
        });

        // let products = await Product.findAll({
        //     where: {
        //         id: {
        //             [Op.in]: sequelize.literal(`(SELECT product FROM inventory_product_stock WHERE sucursal = ${sucursal.id}) and stock - reserved > 0`),
        //         }
        //     }
        // });

        let products = await  sequelize.query(
            'SELECT * FROM inventory_product where id in (SELECT product FROM inventory_product_stock WHERE sucursal = :sucursal and cant > 0)',
            {
                replacements: { sucursal: sucursal.id },
                type: QueryTypes.SELECT,
                model: Product,
            }
        );


        let cajas = await CajaChica.findAll({
                where: {
                    sucursal: sucursal.id,
                }
            });

        res.render('Inventory/Sucursal/sucursal', {
            sucursal,
            pageTitle: sucursal.name,
            sales,
            clients,
            sellers,
            SellersLen,
            ClientsLen,
            products,
            cajas
        });



    },
    getSucursals: async (req, res) => {
        tmp = await Sucursal.findAll({ attributes: ['id', 'name'] });
        return res.json(tmp)

    },
    updateSucursal: async (req, res) => {



    },

};

module.exports = SucursalController;