const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");
// const Product = require('./Product');

const Recount = sequelize.define('Recount', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    sucursal: {
        type: DataTypes.INTEGER.UNSIGNED,
    },
    type: {
        type: DataTypes.ENUM('product', 'material', 'both'),
        defaultValue: 'product',
    },
    createdBy: DataTypes.STRING,
    endBy: DataTypes.STRING,
    endComment: DataTypes.STRING,
    end_date: DataTypes.DATE,
}, {
    tableName: 'inventory_recount',
});

module.exports = Recount;