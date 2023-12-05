const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

// import { Task } from "./Task.js";

module.exports = sequelize.define('Shipment', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    type: {
        type: DataTypes.ENUM,
        values: ['sale', 'translate', 'loan', 'production'],
        defaultValue: 'sale',
    },
    createdBy: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    transportsBy: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    requestedBy: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    direction: {
        type: DataTypes.STRING,
    },
    sale: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
    },
    originSucursal: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
    },
    destinoSucursal: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
    },
    receivedBy: {
        type: DataTypes.STRING(50),
        allowNull: true,
    },
    reversedBy: {
        type: DataTypes.STRING(50),
        allowNull: true,
    },
    reverseComment: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    isIn: {
        type: DataTypes.BOOLEAN,
        defaultValue: 0,
    }
}, {
    tableName: 'inventory_shipment',
});