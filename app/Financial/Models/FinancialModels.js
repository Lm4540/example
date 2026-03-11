const { DataTypes, Op } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");
const InventoryProvider = require('../../Inventory/Models/Provider');

// 1. Modelo: Cuenta por Pagar
const FinancialPayableAccount = sequelize.define('FinancialPayableAccount', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    purchase: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    provider: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    account_date: { type: DataTypes.DATEONLY, allowNull: false },
    _status: {
        type: DataTypes.ENUM('Pendiente', 'Parcial', 'Pagado', 'Anulado'),
        defaultValue: 'Pendiente'
    },
    notes: { type: DataTypes.TEXT },
    createdBy: { type: DataTypes.STRING(50) },
    updatedBy: { type: DataTypes.STRING(50) }
}, {
    tableName: 'financial_payable_account',
    timestamps: true,
    hooks: {
        afterCreate: async (account, options) => {

            await InventoryProvider.increment('balance', {
                by: account.amount,
                where: { id: account.provider },
                transaction: options.transaction
            });
        }
    },
});

// 2. Modelo: Recibo de Pago (Cabecera)
const FinancialProviderReceipt = sequelize.define('FinancialProviderReceipt', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    provider_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    assigned_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
    total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    payment_method: { type: DataTypes.STRING(50), defaultValue: 'Transferencia' },
    ref: { type: DataTypes.STRING(100) },
    move_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    createdBy: { type: DataTypes.STRING(50) },
    updatedBy: { type: DataTypes.STRING(50) },
    type: {
        type: DataTypes.ENUM('Pago', 'Interes', 'Descuento'),
        defaultValue: 'Pago'
    },
}, {
    tableName: 'financial_provider_receipt',
    timestamps: true,
    hooks: {

        afterCreate: async (payment, options) => {
            if (payment.type === 'Pago') {
                await InventoryProvider.increment('payments', {
                    by: payment.total_amount,
                    where: { id: payment.provider_id },
                    transaction: options.transaction
                });
            } else if (payment.type === 'Descuento') {
                await InventoryProvider.decrement('balance', {
                    by: payment.total_amount,
                    where: { id: payment.provider_id },
                    transaction: options.transaction
                });
            } else if (payment.type === 'Interes') {
                await InventoryProvider.increment('balance', {
                    by: payment.total_amount,
                    where: { id: payment.provider_id },
                    transaction: options.transaction
                });
            }
        },
    }
});

// 3. Modelo: Detalle de Pago (Intermedia)
const FinancialPaymentDetail = sequelize.define('FinancialPaymentDetail', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    receipt_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    account_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false }
}, {
    tableName: 'financial_payment_detail',
    timestamps: false,
    hooks: {
        afterCreate: async (detail, options) => {
            await FinancialProviderReceipt.increment('assigned_amount', {
                by: detail.amount,
                where: { id: detail.receipt_id },
                transaction: options.transaction
            });

            const account = await FinancialPayableAccount.findByPk(detail.account_id, {
                include: [{
                    model: FinancialPaymentDetail,
                    as: 'payments',
                    include: [{ model: FinancialProviderReceipt }]
                }],
                transaction: options.transaction
            });

            const totalApplied = account.payments.reduce((acc, mov) => {
                const type = mov.FinancialProviderReceipt.type;
                if (type === 'Interes') return acc + parseFloat(mov.amount);
                return acc - parseFloat(mov.amount); // Pago y Descuento restan deuda
            }, 0);

            const currentBalance = parseFloat(account.amount) + totalApplied;

            let newStatus = 'Parcial';
            if (currentBalance <= 0) newStatus = 'Pagado';
            else if (currentBalance >= parseFloat(account.amount)) newStatus = 'Pendiente';

            await account.update({ _status: newStatus }, { transaction: options.transaction });
        }

    }
});

FinancialProviderReceipt.hasMany(FinancialPaymentDetail, { foreignKey: 'receipt_id', as: 'details' });
FinancialPaymentDetail.belongsTo(FinancialProviderReceipt, { foreignKey: 'receipt_id' });

FinancialPayableAccount.hasMany(FinancialPaymentDetail, { foreignKey: 'account_id', as: 'payments' });
FinancialPaymentDetail.belongsTo(FinancialPayableAccount, { foreignKey: 'account_id' });

InventoryProvider.hasMany(FinancialPayableAccount, { foreignKey: 'provider' });
FinancialPayableAccount.belongsTo(InventoryProvider, { foreignKey: 'provider' });

module.exports = {
    FinancialPayableAccount,
    FinancialProviderReceipt,
    FinancialPaymentDetail,
    InventoryProvider
};