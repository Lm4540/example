const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const PurchaseCost = sequelize.define('PurchaseCost', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    purchase: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    description: DataTypes.STRING,
    price:DataTypes.DECIMAL(10,2),
}, {
    tableName: 'purchase_cost',
});

module.exports = PurchaseCost;