const { Op, QueryTypes, fn, col } = require('sequelize');
const sequelize = require('../../DataBase/DataBase');
const { FinancialPayableAccount,
    FinancialProviderReceipt,
    FinancialPaymentDetail, InventoryProvider } = require('../Models/FinancialModels');




module.exports = {




    main: async (req, res) => {

        // Aqui enviaremos la vista principal con estadisticas, graficos, etc. podemos agregar cosas como flujo de efectivo en caja durante este mes o los depositos recibidos en el bancodurante el mes, los montos de gastos registrados, etc
        try {
            const hoy = new Date();
            const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

            // 1. Deuda Total Pendiente (Neto desglosado abonado)
            const totalDeudaRes = await sequelize.query(`
                SELECT COALESCE(SUM(a.amount - (
                    SELECT COALESCE(SUM(
                        CASE WHEN r.type = 'Interes' THEN -d.amount ELSE d.amount END
                    ), 0)
                    FROM financial_payment_detail d
                    INNER JOIN financial_provider_receipt r ON d.receipt_id = r.id
                    WHERE d.account_id = a.id
                )), 0) as totalDeuda
                FROM financial_payable_account a
                WHERE a._status IN ('Pendiente', 'Parcial')
            `, { type: QueryTypes.SELECT });
            const totalDeuda = parseFloat(totalDeudaRes[0]?.totalDeuda || 0);

            const totalPagadoMes = await FinancialProviderReceipt.sum('total_amount', {
                where: {
                    type: 'Pago',
                    move_date: { [Op.gte]: inicioMes }
                }
            });

            // 2. Datos para Gráfico: Deuda por Proveedor (Top 5)
            const deudaPorProveedor = await sequelize.query(`
                SELECT p.name, 
                SUM(a.amount - (
                    SELECT COALESCE(SUM(
                        CASE WHEN r.type = 'Interes' THEN -d.amount ELSE d.amount END
                    ), 0)
                    FROM financial_payment_detail d
                    INNER JOIN financial_provider_receipt r ON d.receipt_id = r.id
                    WHERE d.account_id = a.id
                )) as saldo
                FROM financial_payable_account a
                INNER JOIN inventory_provider p ON a.provider = p.id
                WHERE a._status IN ('Pendiente', 'Parcial')
                GROUP BY p.id, p.name
                HAVING saldo > 0
                ORDER BY saldo DESC LIMIT 5
            `, { type: QueryTypes.SELECT });

            // 3. Datos para Gráfico: Proyección de Vencimientos (Próximos 30 días)
            const vencimientos = await sequelize.query(`
                SELECT DATE_FORMAT(a.account_date, '%Y-%m-%d') as fecha,
                SUM(a.amount - (
                    SELECT COALESCE(SUM(
                        CASE WHEN r.type = 'Interes' THEN -d.amount ELSE d.amount END
                    ), 0)
                    FROM financial_payment_detail d
                    INNER JOIN financial_provider_receipt r ON d.receipt_id = r.id
                    WHERE d.account_id = a.id
                )) as total
                FROM financial_payable_account a
                WHERE a._status IN ('Pendiente', 'Parcial') AND a.account_date >= :hoy
                GROUP BY DATE_FORMAT(a.account_date, '%Y-%m-%d')
                HAVING total > 0
                ORDER BY fecha ASC
                LIMIT 10
            `, {
                replacements: { hoy: hoy.toISOString().split('T')[0] },
                type: QueryTypes.SELECT
            });

            const accountsList = await FinancialPayableAccount.findAll({
                where: {
                    _status: { [Op.in]: ['Pendiente', 'Parcial'] }
                },
                include: [
                    {
                        model: FinancialPaymentDetail,
                        as: 'payments',
                        include: [{ model: FinancialProviderReceipt }]
                    }
                ],
                order: [['account_date', 'ASC']], // Las más viejas o cercanas primero
                limit: 8
            });

            const proximosVencimientosList = accountsList.map(acc => {
                const data = acc.toJSON();
                const totalApplied = (data.payments || []).reduce((sum, p) => {
                    const type = p.FinancialProviderReceipt ? p.FinancialProviderReceipt.type : 'Pago';
                    if (type === 'Interes') return sum - parseFloat(p.amount);
                    return sum + parseFloat(p.amount);
                }, 0);
                data.currentBalance = parseFloat(data.amount) - totalApplied;
                return data;
            });

            let providers = {};
            const to_index = await InventoryProvider.findAll({ attributes: ['id', 'name'], raw: true });
            to_index.forEach(el => {
                providers[el.id] = el.name;
            });

            //calculo de ingresos Brutos del Mes
            let tmp = await sequelize.query(`SELECT sum(amount) as amount FROM crm_sale_payment WHERE fecha BETWEEN :start AND :end and type = 'money'`, {
                replacements: { start: inicioMes.toISOString().split('T')[0], end: hoy.toISOString().split('T')[0] },
                type: QueryTypes.SELECT
            });
            const money = tmp[0]?.amount || 0;

            tmp = await sequelize.query(`SELECT sum(amount) as amount FROM crm_sale_payment WHERE fecha BETWEEN :start AND :end and type = 'transfer'`, {
                replacements: { start: inicioMes.toISOString().split('T')[0], end: hoy.toISOString().split('T')[0] },
                type: QueryTypes.SELECT
            });
            const deposit = tmp[0]?.amount || 0;


            res.render('Financial/main', {
                deposit, money,
                title: 'Dashboard Financiero',
                stats: {
                    totalDeuda: totalDeuda || 0,
                    totalPagadoMes: totalPagadoMes || 0
                },
                chartData: {
                    proveedores: deudaPorProveedor,
                    vencimientos: vencimientos
                },
                proximosVencimientos: proximosVencimientosList,
                providers
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    },


    createAccount: async (req, res) => {
        try {
            let { purchase, provider, amount, account_date, notes } = req.body;
            amount = parseFloat(amount);
            const createdBy = req.session.userSession.name;
            // account_date = new Date(account_date);

            if (isNaN(amount) || amount <= 0) {
                return res.status(400).json({
                    message: "El monto de la deuda debe ser mayor a cero."
                });
            }

            const newAccount = await FinancialPayableAccount.create({
                purchase: purchase || null,
                provider,
                amount: amount,
                account_date,
                notes,
                createdBy,
                updatedBy: createdBy
            });

            res.status(201).json({
                message: "Cuenta por pagar creada exitosamente",
                data: newAccount
            });

        } catch (error) {
            console.error("Error al crear cuenta por pagar:", error);
            res.status(500).json({
                message: "Error interno al procesar la deuda",
                error: error.message
            });
        }
    },


    listPayableAccounts: async (req, res) => {
        try {
            const { sort } = req.query;
            let orderClause = [['account_date', 'ASC']]; // Default: Próximas a vencer

            // Lógica de ordenamiento
            switch (sort) {
                case 'venc_desc': orderClause = [['account_date', 'DESC']]; break;
                case 'monto_desc': orderClause = [['amount', 'DESC']]; break;
                case 'monto_asc': orderClause = [['amount', 'ASC']]; break;
                case 'fecha_desc': orderClause = [['createdAt', 'DESC']]; break;
                case 'fecha_asc': orderClause = [['createdAt', 'ASC']]; break;
            }

            const accounts = await FinancialPayableAccount.findAll({
                where: { _status: { [Op.in]: ['Pendiente', 'Parcial'] } },
                include: [
                    {
                        model: FinancialPaymentDetail,
                        as: 'payments',
                        include: [{ model: FinancialProviderReceipt }]
                    }
                ],
                order: orderClause,

            });

            let indexed_providers = {};
            // Obtener proveedores para el select del modal
            const providers = await InventoryProvider.findAll({
                attributes: ['id', 'name', 'balance', 'payments'],
                order: [['name', 'ASC']],
                raw: true
            });

            providers.forEach(el => {
                indexed_providers[el.id] = el.name;
            });

            var deudaTotal = 0.00;
            // Formatear datos para la tabla
            const formattedAccounts = accounts.map(acc => {
                const data = acc.toJSON();
                const totalApplied = data.payments.reduce((sum, p) => {
                    const type = p.FinancialProviderReceipt ? p.FinancialProviderReceipt.type : 'Pago';
                    if (type === 'Interes') return sum - parseFloat(p.amount); // Restamos de la resta (suma deuda)
                    return sum + parseFloat(p.amount); // Pagos y Descuentos restan deuda
                }, 0);

                data.provider_name = indexed_providers[data.provider];
                data.currentBalance = parseFloat(data.amount) - totalApplied;
                deudaTotal += data.currentBalance;

                return data;
            });

            res.render('Financial/payables', {
                accounts: formattedAccounts,
                providers,
                title: 'Cuentas por Pagar',
                deudaTotal
            });
        } catch (error) {
            res.status(500).send("Error al cargar vista: " + error.message);
        }
    },

    getPendingByProvider: async (req, res) => {
        try {
            const { providerId } = req.params;
            const accounts = await FinancialPayableAccount.findAll({
                where: {
                    provider: providerId,
                    _status: { [Op.in]: ['Pendiente', 'Parcial'] }
                },
                include: [{ model: FinancialPaymentDetail, as: 'payments' }],
                order: [['account_date', 'ASC']] // Importante para el FIFO del frontend
            });

            const formatted = accounts.map(acc => {
                const data = acc.toJSON();
                const totalApplied = data.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
                return {
                    id: data.id,
                    purchase: data.purchase,
                    account_date: data.account_date,
                    amount: data.amount,
                    currentBalance: (parseFloat(data.amount) - totalApplied).toFixed(2)
                };
            });

            res.json(formatted);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },


    processProviderPayment: async (req, res) => {
        const t = await sequelize.transaction();
        try {
            const { provider_id, total_amount, payment_method, ref, move_date, type, details } = req.body;
            const createdBy = req.session.userSession.name;

            const amount = parseFloat(total_amount);
            if (isNaN(amount) || amount <= 0) {
                return res.status(400).json({ success: false, message: "Monto inválido." });
            }

            // 1. Crear Recibo
            const receipt = await FinancialProviderReceipt.create({
                provider_id,
                total_amount: amount,
                assigned_amount: 0,
                payment_method,
                ref,
                move_date: move_date || new Date(),
                type: type || 'Pago',
                createdBy,
                updatedBy: createdBy
            }, { transaction: t });

            // 2. Crear Detalles (si existen)
            if (Array.isArray(details) && details.length > 0) {
                for (const item of details) {
                    if (parseFloat(item.amount) > 0) {
                        await FinancialPaymentDetail.create({
                            receipt_id: receipt.id,
                            account_id: item.account_id,
                            amount: parseFloat(item.amount)
                        }, { transaction: t });
                    }
                }
            }

            await t.commit();
            res.status(201).json({ success: true, message: "Operación exitosa", receiptId: receipt.id });

        } catch (error) {
            await t.rollback();
            res.status(500).json({ success: false, message: error.message });
        }
    },

    distributeProviderReceipt: async (req, res) => {
        const t = await sequelize.transaction();
        try {
            const { receipt_id, criteria } = req.body; // criteria: 'oldest' | 'dueDate'
            if (!receipt_id) {
                return res.status(400).json({ success: false, message: "ID de recibo requerido." });
            }

            const receipt = await FinancialProviderReceipt.findByPk(receipt_id, { transaction: t });
            if (!receipt) {
                await t.rollback();
                return res.status(404).json({ success: false, message: "Recibo no encontrado." });
            }

            let unassigned = parseFloat(receipt.total_amount) - parseFloat(receipt.assigned_amount);
            if (unassigned <= 0.001) {
                await t.rollback();
                return res.status(400).json({ success: false, message: "Este recibo no tiene saldo a favor pendiente por distribuir." });
            }

            // Criterio de ordenamiento
            let orderClause = [['createdAt', 'ASC'], ['id', 'ASC']];
            if (criteria === 'dueDate') {
                orderClause = [['account_date', 'ASC'], ['id', 'ASC']];
            }

            const pendingAccounts = await FinancialPayableAccount.findAll({
                where: {
                    provider: receipt.provider_id,
                    _status: { [Op.in]: ['Pendiente', 'Parcial'] }
                },
                include: [{
                    model: FinancialPaymentDetail,
                    as: 'payments',
                    include: [{ model: FinancialProviderReceipt }]
                }],
                order: orderClause,
                transaction: t
            });

            if (pendingAccounts.length === 0) {
                await t.rollback();
                return res.status(400).json({ success: false, message: "El proveedor no tiene cuentas pendientes para aplicar este saldo." });
            }

            let appliedTotal = 0;
            for (const account of pendingAccounts) {
                if (unassigned <= 0.001) break;

                const totalApplied = account.payments.reduce((sum, p) => {
                    const type = p.FinancialProviderReceipt ? p.FinancialProviderReceipt.type : 'Pago';
                    if (type === 'Interes') return sum - parseFloat(p.amount);
                    return sum + parseFloat(p.amount);
                }, 0);

                const currentBalance = parseFloat(account.amount) - totalApplied;
                if (currentBalance <= 0.001) continue;

                const amountToApply = Math.min(unassigned, currentBalance);

                await FinancialPaymentDetail.create({
                    receipt_id: receipt.id,
                    account_id: account.id,
                    amount: amountToApply
                }, { transaction: t });

                unassigned -= amountToApply;
                appliedTotal += amountToApply;
            }

            if (appliedTotal === 0) {
                await t.rollback();
                return res.status(400).json({ success: false, message: "No se encontró saldo pendiente por saldar en las obligaciones del proveedor." });
            }

            await t.commit();
            res.status(200).json({
                success: true,
                message: `Se distribuyó un total de $${appliedTotal.toFixed(2)} entre las obligaciones del proveedor.`
            });

        } catch (error) {
            await t.rollback();
            console.error("Error al distribuir recibo:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    getProviderHistory: async (req, res) => {
        try {
            const { id } = req.params;

            // 1. Obtener datos del proveedor
            const provider = await InventoryProvider.findByPk(id);
            if (!provider) return res.status(404).send("Proveedor no encontrado");

            // 2. Obtener todas las Cuentas por Pagar (Deudas)
            const accounts = await FinancialPayableAccount.findAll({
                where: { provider: id },
                order: [['createdAt', 'ASC']]
            });

            // 3. Obtener todos los Recibos (Pagos/Ajustes)
            const receipts = await FinancialProviderReceipt.findAll({
                where: { provider_id: id },
                include: [{ model: FinancialPaymentDetail, as: 'details' }],
                order: [['move_date', 'ASC']]
            });

            // 4. Unificar en una línea de tiempo
            let timeline = [
                ...accounts.map(a => ({
                    date: a.createdAt,
                    type: 'DEUDA',
                    description: `Factura/Compra #${a.purchase || 'S/N'}`,
                    amount: parseFloat(a.amount),
                    status: a._status,
                    refId: a.id,
                    icon: 'fa-file-invoice'
                })),
                ...receipts.map(r => {
                    const totalAmount = parseFloat(r.total_amount);
                    const assignedAmount = parseFloat(r.assigned_amount);
                    const unassignedAmount = Math.max(0, totalAmount - assignedAmount);
                    return {
                        date: r.move_date,
                        type: r.type.toUpperCase(), // PAGO, INTERES, DESCUENTO
                        description: `${r.payment_method} - Ref: ${r.ref || 'N/A'}`,
                        amount: totalAmount,
                        assignedAmount: assignedAmount,
                        unassignedAmount: unassignedAmount,
                        refId: r.id,
                        icon: r.type === 'Pago' ? 'fa-money-bill-1' : (r.type === 'Interes' ? 'fa-arrow-up-right-dots' : 'fa-tags')
                    };
                })
            ];

            // Ordenar cronológicamente
            timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

            // Calcular saldo acumulado histórico para la tabla
            let runningBalance = 0;
            timeline = timeline.map(item => {
                if (item.type === 'DEUDA' || item.type === 'INTERES') {
                    runningBalance += item.amount;
                } else {
                    runningBalance -= item.amount;
                }
                return { ...item, runningBalance };
            });

            res.render('Financial/provider_history', {
                provider,
                timeline: timeline.reverse(), // Mostrar lo más reciente arriba
                title: `Historial: ${provider.name}`
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    },

    getPaidAccountsHistory: async (req, res) => {
        try {
            let { start, end, providerId } = req.query;
            let whereClause = {
                _status: { [Op.in]: ['Pagado', 'Anulado'] }
            };

            if (start && end) {
                whereClause.createdAt = { [Op.between]: [start, end] };
            } else {
                const fechaFin = new Date();
                const fechaInicio = new Date();
                fechaInicio.setMonth(fechaInicio.getMonth() - 3); // Restamos 3 meses exactos
                whereClause.createdAt = { [Op.between]: [fechaInicio, fechaFin] };
                start = fechaInicio.toISOString().split('T')[0];
                if (!end) end = fechaFin.toISOString().split('T')[0];
            }

            // Filtro por proveedor específico
            if (providerId) {
                whereClause.provider = providerId;
            }

            const paidAccounts = await FinancialPayableAccount.findAll({
                where: whereClause,
                include: [
                    {
                        model: FinancialPaymentDetail,
                        as: 'payments',
                        include: [{ model: FinancialProviderReceipt, attributes: ['ref', 'move_date'] }]
                    }
                ],
                order: [['updatedAt', 'DESC']] // Ver lo más recientemente pagado primero
            });

            const providers = await InventoryProvider.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] });
            let indexed_providers = {};
            providers.forEach(p => indexed_providers[p.id] = p.name);
            res.render('Financial/paid_history', {
                accounts: paidAccounts,
                providers,
                filters: { start, end, providerId },
                title: 'Historial de Cuentas Liquidadas',
                start, end,
                indexed_providers,
            });
        } catch (error) {
            res.status(500).send("Error al cargar historial: " + error.message);
        }
    },


    getAccountDetail: async (req, res) => {
        try {
            const { id } = req.params;

            const account = await FinancialPayableAccount.findByPk(id, {
                include: [
                    { model: InventoryProvider, attributes: ['name', 'id', 'balance', 'payments'] },
                    {
                        model: FinancialPaymentDetail,
                        as: 'payments',
                        include: [{ model: FinancialProviderReceipt }] // Para ver fecha y ref del pago
                    }
                ]
            });

            if (!account) return res.status(404).send("Cuenta no encontrada");

            // Calculamos el saldo actual para la vista
            const totalApplied = account.payments.reduce((sum, p) => {
                const type = p.FinancialProviderReceipt.type;
                return type === 'Interes' ? sum + parseFloat(p.amount) : sum - parseFloat(p.amount);
            }, 0);


            const provider = await InventoryProvider.findByPk(account.provider);

            const currentBalance = parseFloat(account.amount) + totalApplied;

            res.render('Financial/account_detail', {
                account,
                currentBalance,
                title: `Detalle Cuenta #${account.id}`,
                provider
            });
        } catch (error) {
            res.status(500).send("Error al cargar el detalle: " + error.message);
        }
    },

    getPaymentReceivedReport: async (req, res) => {
        try {
            let { start, end, type } = req.query;
            const hoy = new Date();
            const haceUnMes = new Date();
            haceUnMes.setMonth(haceUnMes.getMonth() - 1);
            const fechaInicio = start || haceUnMes.toISOString().split('T')[0];
            const fechaFin = end || hoy.toISOString().split('T')[0];

            let filter = 'fecha BETWEEN :start AND :end';
            const replacements = { start: fechaInicio, end: fechaFin };

            if (type && type !== 'all') {
                filter += " AND type = :type";
                replacements.type = type;
            }

            const clientQuery = `SELECT id, name FROM crm_client WHERE id IN (SELECT DISTINCT(client) FROM crm_sale_payment WHERE ${filter})`;
            const clientsRaw = await sequelize.query(clientQuery, { replacements, type: QueryTypes.SELECT });

            const indexedClients = {};
            clientsRaw.forEach(c => indexedClients[c.id] = c.name);

            const order = " ORDER BY createdAt DESC";
            const paymentsRaw = await sequelize.query(`SELECT * FROM crm_sale_payment WHERE ${filter} ${order}`, {
                replacements,
                type: QueryTypes.SELECT
            });

            const stats = { money: 0, transfer: 0, total: 0 };
            const formattedPayments = paymentsRaw.map(p => {
                const amount = parseFloat(p.amount) || 0;
                stats.total += amount;
                if (p.type === 'money') stats.money += amount;
                if (p.type === 'transfer') stats.transfer += amount;

                return {
                    ...p,
                    client_name: indexedClients[p.client] || 'Cliente no encontrado'
                };
            });

            res.render('Financial/received_payments', {
                title: 'Reporte de Ingresos Brutos',
                payments: formattedPayments,
                stats,
                filters: { start: fechaInicio, end: fechaFin, type }
            });

        } catch (error) {
            res.status(500).send("Error: " + error.message);
        }
    },

    listProviders: async (req, res) => {
        try {
            const providers = await InventoryProvider.findAll({
                order: [['name', 'ASC']],
                raw: true
            });

            // Obtener para cada proveedor el total de cuentas pendientes/parciales y saldos a favor
            const financialStats = await sequelize.query(`
                SELECT 
                    p.id as provider_id,
                    COUNT(a.id) as pending_accounts_count,
                    COALESCE(SUM(a.amount - (
                        SELECT COALESCE(SUM(CASE WHEN r.type = 'Interes' THEN -d.amount ELSE d.amount END), 0)
                        FROM financial_payment_detail d
                        INNER JOIN financial_provider_receipt r ON d.receipt_id = r.id
                        WHERE d.account_id = a.id
                    )), 0) as real_pending_debt
                FROM inventory_provider p
                LEFT JOIN financial_payable_account a ON a.provider = p.id AND a._status IN ('Pendiente', 'Parcial')
                GROUP BY p.id
            `, { type: QueryTypes.SELECT });

            const unassignedStats = await sequelize.query(`
                SELECT 
                    provider_id,
                    COALESCE(SUM(total_amount - assigned_amount), 0) as unassigned_balance
                FROM financial_provider_receipt
                WHERE type = 'Pago' AND (total_amount - assigned_amount) > 0.001
                GROUP BY provider_id
            `, { type: QueryTypes.SELECT });

            const statsMap = {};
            financialStats.forEach(item => {
                statsMap[item.provider_id] = {
                    pendingCount: parseInt(item.pending_accounts_count || 0),
                    realDebt: parseFloat(item.real_pending_debt || 0),
                    unassignedBalance: 0
                };
            });

            unassignedStats.forEach(item => {
                if (!statsMap[item.provider_id]) {
                    statsMap[item.provider_id] = { pendingCount: 0, realDebt: 0, unassignedBalance: 0 };
                }
                statsMap[item.provider_id].unassignedBalance = parseFloat(item.unassigned_balance || 0);
            });

            const formattedProviders = providers.map(p => {
                const stats = statsMap[p.id] || { pendingCount: 0, realDebt: 0, unassignedBalance: 0 };
                return {
                    ...p,
                    balance: parseFloat(p.balance || 0),
                    payments: parseFloat(p.payments || 0),
                    deudaNet: parseFloat(p.balance || 0) - parseFloat(p.payments || 0),
                    realDebt: stats.realDebt,
                    pendingCount: stats.pendingCount,
                    unassignedBalance: stats.unassignedBalance
                };
            });

            res.render('Financial/providers', {
                title: 'Lista de Proveedores - Gestión Financiera',
                providers: formattedProviders
            });
        } catch (error) {
            res.status(500).send("Error al cargar lista de proveedores: " + error.message);
        }
    }

};
