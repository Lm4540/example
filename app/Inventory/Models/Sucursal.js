const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

// import { Task } from "./Task.js";

const Sucursal = sequelize.define('Sucursal', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    location: {
        type: DataTypes.STRING(255),
    },
    mapLink: {
        type: DataTypes.TEXT,
    },
    balance: {
        type: DataTypes.DECIMAL(10,2), 
        defaultValue:0.00, 
        get(){
            let _val = Number.parseFloat(this.getDataValue('balance'));
            return isNaN(_val) ? 0.00 : _val
        }
    },
    hasAreas: DataTypes.BOOLEAN,
    isWharehouse: DataTypes.BOOLEAN,
    isSalesRoom: DataTypes.BOOLEAN,
}, {
    tableName: 'system_sucursal',
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

module.exports = Sucursal;