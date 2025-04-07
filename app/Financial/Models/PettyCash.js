const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const PettyCash = sequelize.define('PettyCash', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    last_user: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
    },
    balance: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        get() {
            let _val = Number.parseFloat(this.getDataValue('balance'));
            return isNaN(_val) ? 0.00 : _val
        }
    },
    sucursal: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    codPuntoVentaMH: {
        type: DataTypes.STRING(10),
        allowNull: true,
    },
    codPuntoVenta: {
        type: DataTypes.STRING(10),
        allowNull: true,
    },
}, {
    tableName: 'financial_petty_cash',
});


module.exports = PettyCash;

