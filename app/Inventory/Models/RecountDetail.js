const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const RecountDetail = sequelize.define('RecountDetail', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    recount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    product: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    product_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    sku: DataTypes.STRING(20),
    initial: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0
    },
    final: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0
    },
    observation: DataTypes.STRING(300),
    revised_by: DataTypes.STRING,
    cost: DataTypes.DECIMAL(10, 2),
}, {
    tableName: 'inventory_recount_detail',
});

module.exports = RecountDetail;