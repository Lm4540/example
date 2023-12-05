const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const BudgetDetail = sequelize.define('BudgetDetail', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    budget: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    product: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    cant: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    price: {
        type: DataTypes.DECIMAL(10,2),
    },
    description: DataTypes.TEXT,
    image: DataTypes.STRING,
    _order: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: false,
    },
}, {
    tableName: 'crm_budget_detail',
    timestamps: false,
});

module.exports = BudgetDetail;