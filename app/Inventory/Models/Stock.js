const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


const Stock = sequelize.define('Stock', {
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
        defaultValue: 0,
    },
    reserved: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
    },
}, {
    tableName: 'inventory_product_stock',
    timestamps: false,
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

module.exports = Stock;