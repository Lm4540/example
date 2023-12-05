const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


// Pendiente de revision
const InvoiceSeries = sequelize.define('InvoiceSeries', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    init: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    end: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    serie: DataTypes.STRING(15),
    type: {
        type: DataTypes.ENUM('ccf', 'fcf', 'fex', 'nr', 'nc', 'nd'),
        defaultValue: 'fcf'
    },
    used: DataTypes.INTEGER.UNSIGNED,
    active: DataTypes.BOOLEAN,
    sucursal: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    
}, {
    tableName: 'crm_invoice_serie',
    timestamps: false,
});

module.exports = InvoiceSeries;