const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


// Pendiente de revision
const InvoiceDetail = sequelize.define('InvoiceDetail', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    invoice: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    sale_detail: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    cant: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    price: DataTypes.DECIMAL(10,2),
    iva: DataTypes.DECIMAL(10,2),
    description: DataTypes.TEXT,
    type: {
        type: DataTypes.ENUM('gravada', 'exenta', 'no_sujeta'),
        defaultValue: 'gravada'
    },
    _order: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: false,
    },
}, {
    tableName: 'crm_invoice_detail',
    timestamps: false,
});

module.exports = InvoiceDetail;