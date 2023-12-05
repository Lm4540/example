const { Sequelize, DataTypes, DECIMAL } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


//invoice pendiente de revision
const Invoice = sequelize.define('Invoice', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    sale: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    seller: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    sucursal: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    credit_conditions: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
    },
    
    type: {
        type: DataTypes.ENUM('ccf', 'fcf', 'fex', 'nr', 'nc', 'nd'),
        defaultValue: 'fcf',
    },
    iva: DataTypes.DECIMAL(10,2),
    subtotal: DataTypes.DECIMAL(10,2),
    retention: DataTypes.DECIMAL(10,2),
    perception: DataTypes.DECIMAL(10,2),
    exento: DataTypes.DECIMAL(10,2),
    revoked_at: {type: DataTypes.DATE,},
    revoked_reason: DataTypes.STRING,
    collected: DataTypes.DECIMAL(10,2),
    version: DataTypes.INTEGER.UNSIGNED
}, {
    tableName: 'crm_invoice',
});

module.exports = Invoice;