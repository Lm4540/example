const { DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const PettyCashConsignment = sequelize.define('PettyCashConsignment', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    petty_cash_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
    },
    is_consignment: {
        type: DataTypes.BOOLEAN, // true: Consignación (+), false: Devolución (-)
        allowNull: false
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allow_null: false,
        defaultValue: 0.00
    },
    previous_balance: {
        type: DataTypes.DECIMAL(10, 2),
        allow_null: false,
        defaultValue: 0.00
    },
    comment: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    createdBy: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'financial_petty_cash_consigned_history',
    timestamps: true,
    updatedAt: false, // Solo necesitamos createdAt
    charset: 'utf8mb4',
    collate: 'utf8mb4_spanish_ci'
});

module.exports = PettyCashConsignment;