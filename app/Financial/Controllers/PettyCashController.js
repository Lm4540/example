const { Op, QueryTypes, where } = require('sequelize');
const sequelize = require('../../DataBase/DataBase');
const Sucursal = require('../../Inventory/Models/Sucursal');
const PettyCashMoves = require('../Models/PettyCashMoves');
const PettyCash = require('../Models/PettyCash');
const PettyCashClosing = require('../Models/PettyCashClosing');
const Helper = require('../../System/Helpers');
const Sale = require('../../CRM/Models/Sale');
const SalePayment = require('../../CRM/Models/SalePayment');
const Client = require('../../CRM/Models/Client');

const PettyCashController = {

    createPettyCash: async (req, res) => {
        let data = req.body;


        if (data.name == "" || data.name == null || data.codPuntoVentaMH == null || data.codPuntoVentaMH == "" || data.codPuntoVenta == null || data.codPuntoVenta == "") {
            return res.json({ status: 'error', message: 'Pior Favor complete todos los datos' });
        }

        let sucursal = await Sucursal.findByPk(data.sucursal);

        if (sucursal) {
            let caja = await PettyCash.create({
                name: data.name,
                codPuntoVentaMH: data.codPuntoVentaMH,
                codPuntoVenta: data.codPuntoVenta,
                sucursal: sucursal.id,
            });
            return res.json({ status: 'success', data: caja.id });
        }
    },

    updatePettyCash: async (req, res) => {
        let caja = await PettyCash.findByPk(req.body.id);

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
            cajas = await PettyCash.findAll({ attributes: ['id', 'name', 'sucursal'] });

            return res.render('Financial/PettyCash/viewList', { pageTitle: 'Selecciona una sucursal', sucursals, cajas });
        } else {
            res.redirect(`/financial/pettycash/${req.session.userSession.employee.sucursal}`);
        }
    },

    viewPettyCash: async (req, res) => {
        //Si tiene Permiso para manejar todas las cajas mostrar la lista de sucursales
        let sucursal = await PettyCash.findByPk(req.params.id);
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

        // if (req.query.print !== undefined && req.query.init !== false) {
        //     return res.render(`Financial/PettyCash/printMoves`, { pageTitle: `Caja Chica ${sucursal.name}`, sucursal, moves });
        // }

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

        console.log(data)
        data.amount = Number.parseFloat(data.amount);
        if (isNaN(data.amount)) {
            return res.json({ status: 'errorMessage', message: 'Monto no válido' });
        } else if (data.concept.length < 5) {
            return res.json({ status: 'errorMessage', message: 'Proporcione una descripcion para registrar este movimiento' });
        } else if (data.asigned_to.length < 5) {
            return res.json({ status: 'errorMessage', message: 'Proporcione indicar el nombre de la persona que recibe o deposita el dinero' });
        }

        let isIn = data.type == 'refill';


        let sucursal = await PettyCash.findByPk(data.sucursal);

        if (sucursal) {
            if (!isIn && sucursal.balance < data.amount) {
                return res.json({ status: 'errorMessage', message: 'Efectivo insuficiente para realizar este desembolso' });
            }
            //Determinar si el movimiento es una salida o un ingreso
            let count = !isIn ? await PettyCashMoves.count({ where: { [Op.and]: { petty_cash: sucursal.id, isin: false } } }) : -1;
            //obtener el numero de movimientos para la caja seleccionada
            let move = {
                amount: data.amount,
                last_amount: sucursal.balance,
                concept: data.concept,
                petty_cash: sucursal.id,
                type: data.type == 'out' ? 'payment' : data.type,
                isin: isIn,
                createdBy: req.session.userSession.name,
                asigned_to: data.asigned_to,
                _number: count + 1,
            }


            try {
                return await sequelize.transaction(async (t) => {
                    move = await PettyCashMoves.create(move, { transaction: t });
                    sucursal.balance = isIn ? (sucursal.balance + data.amount) : (sucursal.balance - data.amount);
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

    saldos_a_favor: async (req, res) => {
        //buscar los pagos cuyos saldos no hayan sido aplicados

        let tmp = await sequelize.query("SELECT * FROM `crm_sale_payment` WHERE amount > asigned_amount", { type: QueryTypes.SELECT, model: SalePayment });

        let payments = {};
        tmp.forEach((el) => {
            if (payments[el.client] === undefined) {
                payments[el.client] = [];
            }
            payments[el.client].push(el)
        });




        //buscar las ventas de dichos clientes

        tmp = await sequelize.query(`SELECT * FROM crm_sale WHERE _status in('delivered', 'transport','prepared','process') and client in (SELECT DISTINCT (client) FROM crm_sale_payment WHERE amount > asigned_amount)`, { type: QueryTypes.SELECT, model: Sale });
        let sales = {};
        tmp.forEach((el) => {
            if (sales[el.client] === undefined) {
                sales[el.client] = [];
            }
            sales[el.client].push(el)
        });

        //buscars los clientes a los que pertenezcan dichos pagos
        clients = await sequelize.query(`SELECT * FROM crm_client WHERE id in (SELECT DISTINCT (client) FROM crm_sale_payment WHERE amount > asigned_amount)`, { type: QueryTypes.SELECT, model: Client });


        return res.render(`Financial/aFavor`, { pageTitle: 'Saldos a Favor', clients, sales, payments });


    },

    getArqueoView: async (req, res) => {

        try {



            const { id } = req.params;
            let cash = await PettyCash.findByPk(id);
            if (cash) {
                const arqueo = await PettyCashClosing.findOne({
                    where: {
                        petty_cash_id: id,
                        status: 'Pendiente'
                    }
                })
                if (arqueo) {
                    console.log(arqueo)
                    const denominations = arqueo.denominations;
                    const _labels = {
                        "100": "Billetes $100.00", "50": "Billetes $50.00", "20": "Billetes $20.00",
                        "10": "Billetes $10.00", "5": "Billetes $5.00", "1": "Billetes/Moneda $1.00",
                        "0.25": "Monedas $0.25", "0.1": "Monedas $0.10", "0.05": "Monedas $0.05", "0.01": "Monedas $0.01"
                    };

                    return res.render('Financial/PettyCash/verify_arqueo', {
                        title: 'Cuentas por Pagar',
                        arqueo,
                        denominations,
                        _labels,
                        cash
                    });
                }

                return res.render('Financial/PettyCash/petty_cash_closing', {
                    title: 'Cuentas por Pagar',
                    cash,
                });
            }

            return res.json({
                status: 'errorMessage', message: 'Recurso no encontrado'
            });

        } catch (error) {
            return res.json({
                status: 'errorMessage', message: error.message
            });
        }
    },


    createArqueo: async (req, res) => {
        try {
            const { petty_cash_id, denominations, physical_balance, notes } = req.body;
            if (!petty_cash_id || !denominations || !physical_balance) {
                return res.status(500).json({
                    status: 'errorMessage', message: 'Campos incompletos'
                });
            }
            const cashier_user = req.session.userSession.name;

            const cash = await PettyCash.findByPk(petty_cash_id);

            const closing = await PettyCashClosing.create({
                petty_cash_id,
                system_balance: cash.balance,
                consigned_amount: cash.consigned_balance,
                physical_balance,
                difference: (parseFloat(physical_balance) + parseFloat(cash.consigned_balance)) - parseFloat(cash.balance),
                denominations,
                cashier_user,
                verifier_user: 'PENDIENTE', // Aún no hay verificador
                status: 'Pendiente',
                notes
            });

            res.status(201).json({ status: 'success', message: "Arqueo registrado. Pendiente de verificación." });
        } catch (error) {
            res.status(500).json({ status: 'errorMessage', message: error.message });
        }
    },

    // PASO 2: El Supervisor verifica con SU sesión
    verifyArqueo: async (req, res) => {
        const t = await sequelize.transaction();
        try {
            const { closing_id, action, notes } = req.body;
            if (action == 'Delete') {
                await PettyCashClosing.destroy({ where: { id: closing_id } }, { transaction: t });
                await t.commit();
                return res.json({ success: true, message: `Arqueo eliminado` });
            }
            const verifier_user = req.session.userSession.shortName;
            const closing = await PettyCashClosing.findByPk(closing_id, { transaction: t });

            if (closing.cashier_user === verifier_user) {
                throw new Error("El cajero y el verificador no pueden ser la misma persona.");
            }

            if (req.session.userSession.permission.includes('verify_petty_cash_clossing')) {
                await closing.update({
                    verifier_user,
                    status: action,
                    verifiedAt: new Date(),
                    notes
                }, { transaction: t });

                await t.commit();
                return res.json({ success: true, message: `Arqueo ${action} por ${verifier_user}` });
            }

            return res.json({ success: false, message: `No tienes permiso de Verificar este arqueo` });
        } catch (error) {
            await t.rollback();
            return res.status(403).json({ success: false, message: error.message });
        }
    },

    viewArqueos: async (req, res) => {
        let { start, end, cash } = req.query;
        let whereClause = {
            petty_cash_id: cash
        };

        if (start && end) {
            whereClause.createdAt = { [Op.between]: [start, end] };
        } else {
            const fechaFin = new Date();
            const fechaInicio = new Date();
            fechaInicio.setMonth(fechaInicio.getMonth() - 1); // Restamos 1 meses exactos
            whereClause.createdAt = { [Op.between]: [fechaInicio, fechaFin] };
            start = fechaInicio.toISOString().split('T')[0];
            if (!end) end = fechaFin.toISOString().split('T')[0];
        }

        let arqueos = await PettyCashClosing.findAll({
            where: whereClause,
            orderorder: [['createdAt', 'DESC']]
        });

        cash = await PettyCash.findByPk(cash);
        return res.render('Financial/PettyCash/viewArqueos', { pageTitle: `Caja Chica ${cash.name}`, cash, start, end, arqueos });

    },

    viewArqueo: async (req, res) => {
        let arqueo = await PettyCashClosing.findByPk(req.params.id);
        if (arqueo) {
            let cash = await PettyCash.findByPk(arqueo.petty_cash_id);
            return res.render('Financial/PettyCash/viewArqueo', { pageTitle: `Caja Chica ${arqueo.petty_cash_id}`, arqueo, cash });


        }
    },

    ConsignarSaldo: async (req, res) => {
        let data = req.body;
        data.amount = Number.parseFloat(data.amount);
        console.log(data)

        if (isNaN(data.amount)) {
            return res.json({ success: false, message: 'Monto no válido' });
        }
        let cash = await PettyCash.findByPk(data.cash);
        if (cash) {
            try {

                if (data.consignar) {
                    await PettyCash.increment('consigned_balance', {
                        by: data.amount,
                        where: { id: cash.id },
                    });
                } else {
                    await PettyCash.decrement('consigned_balance', {
                        by: data.amount,
                        where: { id: cash.id },
                    });
                }
                return res.json({ success: true, message: 'Registrado' });
            } catch (error) {

                return res.json({ success: false, message: error.message });
            }
        }
        return res.json({ success: false, message: 'Caja Chica Not Found!' });
    },
};

module.exports = PettyCashController;