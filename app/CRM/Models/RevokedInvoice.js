const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


//invoice pendiente de revision
const RevokedInvoice = sequelize.define('RevokedInvoice', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    invoice_number: DataTypes.NUMBER,
    invoice_serie: DataTypes.NUMBER,
    invoice_date: DataTypes.DATE,
    sale: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    sucursal: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
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
    isr: DataTypes.DECIMAL(10,2),
    revoked_at: {type: DataTypes.DATE,},
    revoked_reason: DataTypes.STRING,
    version: DataTypes.INTEGER.UNSIGNED,
    details: {
        type: DataTypes.TEXT,
        get
    }
    
}, {
    tableName: 'crm_revoked_invoice',
});

module.exports = RevokedInvoice;