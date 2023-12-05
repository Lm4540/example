const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const Budget = sequelize.define('Budget', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    client: {
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
    _date: {
        type: DataTypes.DATE,
    },
    valid_days: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 3,
    },
    credit_conditions: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
    },
    whitRetention: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    whitPerception: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    whitIVA: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    version: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
    },
    authorization_date: {
        type: DataTypes.DATE,
    },
    authorized_by: DataTypes.STRING,
    metadata: DataTypes.TEXT,
    stat: {
        type: DataTypes.ENUM('writting', 'authorized', 'printed', 'declined', 'partial', 'sale'),
        defaultValue: 'writting'
    },
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    atention_to: DataTypes.STRING,
    comment: DataTypes.TEXT,
    
}, {
    tableName: 'crm_budget',
});

module.exports = Budget;