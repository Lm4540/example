const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

// import { Task } from "./Task.js";

module.exports = sequelize.define('ShipmentDetail', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    shipment: {
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
    cost:{
        type: DataTypes.DECIMAL(10,2), 
        defaultValue:0.00, 
        get(){
            let _val = Number.parseFloat(this.getDataValue('cost'));
            return isNaN(_val) ? 0.00 : _val
        }
    },

    description: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },

    in:  {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue:0
    },
    
    sale_detail: { 
        type: DataTypes.TEXT,
        get() {
            let prefe = this.getDataValue('sale_detail');
            return (prefe !== null && prefe !== undefined) ? JSON.parse(prefe) : new Array();
        },
        set(param) {
            this.setDataValue('sale_detail', JSON.stringify(param == null ? new Array() : param) );
        }
    },
}, {
    tableName: 'inventory_shipment_detail',
});