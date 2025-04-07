const { Op, QueryTypes } = require('sequelize');
const sequelize = require('../../DataBase/DataBase');
const Sucursal = require('../../Inventory/Models/Sucursal');
const PettyCashMoves = require('../Models/PettyCashMoves');
const CajaChica = require('../Models/PettyCash');
const Helper = require('../../System/Helpers');

const FinancialController = {

    createPettyCash: async (req, res) => {
        let data = req.body;


        if (data.name == "" || data.name == null || data.codPuntoVentaMH == null || data.codPuntoVentaMH == "" || data.codPuntoVenta == null || data.codPuntoVenta == "") {
            return res.json({ status: 'error', message: 'Pior Favor complete todos los datos' });
        }

        let sucursal = await Sucursal.findByPk(data.sucursal);

        if (sucursal) {
            let caja = await CajaChica.create({
                name: data.name,
                codPuntoVentaMH: data.codPuntoVentaMH,
                codPuntoVenta: data.codPuntoVenta,
                sucursal: sucursal.id,
            });
            return res.json({ status: 'success', data: caja.id });
        }
    },

    updatePettyCash: async (req, res) => {
        let caja = await CajaChica.findByPk(req.body.id);

        if (caja) {
            caja.name = req.body.name;
            caja.codPuntoVentaMH = req.body.codPuntoVentaMH;
            caja.codPuntoVenta = req.body.codPuntoVenta;
            await caja.save();
            return res.json({ status: 'success', message: 'Guardado con Exito' });
        }
        return res.json({ status: 'error', message: 'Caja no encontrada' });
    },

    printVoucher: async (req, res) => {
        let move = await PettyCashMoves.findByPk(req.params.id);
        if (move && (move.isin === false || move.isin === 0)) {
            //buscar la sucursal a la que pertenece
            let caja = await PettyCash.findByPk(move.petty_cash);
            let sucursal = await Sucursal.findByPk(caja.sucursal);
            return res.render('Financial/PettyCash/printVoucher', { pageTitle: 'Imprimir Vale', sucursal, move, caja });
        }
        return Helper.notFound(req, res, "Vale de caja no emitido o no encontrado")

    },
    pettycash: async (req, res) => {
        //Si tiene Permiso para manejar todas las cajas mostrar la lista de sucursales 
        if (req.session.userSession.permission.includes('admin_all_petty_cash')) {
            let cajas = await Sucursal.findAll();
            let sucursals = {};
            cajas.forEach(element => { sucursals[element.id] = element.name; });
            cajas = await CajaChica.findAll({ attributes: ['id', 'name', 'sucursal'] });

            return res.render('Financial/PettyCash/viewList', { pageTitle: 'Selecciona una sucursal', sucursals, cajas });
        } else {
            res.redirect(`/financial/pettycash/${req.session.userSession.employee.sucursal}`);
        }
    },

    viewPettyCash: async (req, res) => {
        //Si tiene Permiso para manejar todas las cajas mostrar la lista de sucursales
        let sucursal = await CajaChica.findByPk(req.params.id);
        let init = null, end = null;
        if (req.query.init !== undefined) {
            init = `${req.query.init} 00:00:00`;
            end = req.query.end !== undefined ? `${req.query.end} 23:59:59` : `${req.query.init} 23:59:59`;;
        } else {
            let day = new Date();
            init = `${day.getFullYear()}-${day.getMonth() < 9 ? `0${day.getMonth() + 1}` : day.getMonth() + 1}-${day.getDate() > 9 ? day.getDate() : '0' + day.getDate()}`
            end = `${init} 23:59:59`;
            init = `${init} 00:00:00`;
        }
        //buscar los movimientos de este dia

        //Buscar los items de Recoleccion Pendiente
        let recolections = [];
        let moves = await PettyCashMoves.findAll({
            where: {
                [Op.and]: [{
                    petty_cash: sucursal.id
                }, {
                    createdAt: { [Op.between]: [init, end] }
                }],
            }
        });

        if (req.query.print !== undefined && req.query.init !== false) {
            return res.render(`Financial/PettyCash/printMoves`, { pageTitle: `Caja Chica ${sucursal.name}`, sucursal, moves });
        }

        if (req.session.userSession.permission.includes('admin_all_petty_cash')) {
            return res.render(`Financial/PettyCash/adminPettyCash`, { pageTitle: `Caja Chica ${sucursal.name}`, sucursal, moves });
        } else if (req.params.id == req.session.userSession.employee.sucursal) {
            return res.render(`Financial/PettyCash/${req.session.userSession.permission.includes('admin_petty_cash') ? 'adminPettyCash' : 'viewPettyCash'}`, { pageTitle: `Caja Chica ${sucursal.name}`, sucursal, moves });
        } else {
            res.redirect(`/financial/pettycash/${req.session.userSession.employee.sucursal}`);
        }
    },


    addMove: async (req, res) => {
        //obtener el monto anterior
        let data = req.body;
        data.amount = Number.parseFloat(data.amount);
        if (isNaN(data.amount)) {
            return res.json({ status: 'errorMessage', message: 'Monto no válido' });
        } else if (data.concept.length < 5) {
            return res.json({ status: 'errorMessage', message: 'Proporcione una descripcion para registrar este movimiento' });
        } else if (data.asigned_to.length < 5) {
            return res.json({ status: 'errorMessage', message: 'Proporcione indicar el nombre de la persona que recibe o deposita el dinero' });
        }


        let sucursal = await CajaChica.findByPk(data.sucursal);

        if (sucursal) {
            if (data.type == "out" && sucursal.balance < data.amount) {
                return res.json({ status: 'errorMessage', message: 'Efectivo insuficiente para realizar este desembolso' });
            }
            //Determinar si el movimiento es una salida o un ingreso
            let count = data.type == 'out' ? await PettyCashMoves.count({ where: { [Op.and]: { petty_cash: sucursal.id, isin: false } } }) : -1;
            //obtener el numero de movimientos para la caja seleccionada
            let move = {
                amount: data.amount,
                last_amount: sucursal.balance,
                concept: data.concept,
                petty_cash: sucursal.id,
                type: data.type == 'out' ? 'payment' : data.type,
                isin: data.type == "out" ? false : true,
                createdBy: req.session.userSession.name,
                asigned_to: data.asigned_to,
                _number: count + 1,
            }


            try {
                return await sequelize.transaction(async (t) => {
                    move = await PettyCashMoves.create(move, { transaction: t });
                    sucursal.balance = data.type == "out" ? (sucursal.balance - data.amount) : (sucursal.balance + data.amount);
                    await sucursal.save({ transaction: t });
                    return res.json({ status: 'success', move, new_amount: sucursal.balance });
                });
            } catch (error) {
                return res.json({ status: 'error', message: error.message });
            }
        }

        return res.json({
            status: 'errorMessage', message: 'Sucursal Not Found!'
        });
    },

};

module.exports = FinancialController;