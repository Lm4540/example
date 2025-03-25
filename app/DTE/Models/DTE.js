const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


module.exports = sequelize.define('DTE', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    sale: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    }


}, {
    tableName: 'crm_dte',
});