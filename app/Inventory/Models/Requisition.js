const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const Requisition = sequelize.define('Requisition', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },

    origin: {
        type: DataTypes.INTEGER.UNSIGNED
    },
    destino: {
        type: DataTypes.INTEGER.UNSIGNED
    },
    _status: {
        type: DataTypes.ENUM('open', 'closed'),
        defaultValue: 'open',
    },
    createdBy: DataTypes.STRING,
    commentary: DataTypes.TEXT,
}, {
    tableName: 'inventory_requisition',
});

module.exports = Requisition;






