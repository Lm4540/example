const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


const StockReserve = sequelize.define('StockReserve', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    cant: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
    },
    sucursal: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    product: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    createdBy: {
        type: DataTypes.STRING,
    },
    concept: {
        type: DataTypes.STRING(400),
    },
    type: {
        type: DataTypes.ENUM('sale', 'production', 'manual')
    },
    saleId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
    },
    orderId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
    },
    other_concept: DataTypes.STRING(400)
}, {
    tableName: 'inventory_product_stock_reserve',
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

module.exports = StockReserve;