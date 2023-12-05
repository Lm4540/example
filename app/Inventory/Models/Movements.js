const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");
const Stock = require('./Stock')

// import { Task } from "./Task.js";

const Movement = sequelize.define('Movement', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    product: {
        type: DataTypes.INTEGER.UNSIGNED,
    },
    sucursal: {
        type: DataTypes.INTEGER.UNSIGNED,
    },
    cant: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    last_sucursal_stock: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    last_product_stock: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    last_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    in: DataTypes.BOOLEAN,
    sale_detail: DataTypes.INTEGER.UNSIGNED,
    concept: DataTypes.STRING,
    createdBy: DataTypes.STRING(50),
}, {
    tableName: 'inventory_product_movement',
});

// Stock.hasMany(Movement);
// Movement.belongsTo(Stock);

// Product.hasMany(Task, {
//     foreignKey: 'projectId',
//     sourceKey: 'id'
// });

// Task.belongsTo(Project, {
//     foreignKey: 'projectId',
//     targetId: 'id'
// })

module.exports = Movement;