const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");
const Product = require('./Product');

// import { Task } from "./Task.js";

const Provider = sequelize.define('Provider', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    type: {
        type: DataTypes.ENUM('product', 'services', 'transport'),
        defaultValue: 'product',
    },
    numberOfPurchase: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0
    },
    NIT_DUI: {
        type: DataTypes.STRING
    },
    NRC: {
        type: DataTypes.STRING
    },
    web: {
        type: DataTypes.STRING
    },
    image: {
        type: DataTypes.TEXT,
        get(){
            const storedValue = this.getDataValue('image');
            return storedValue !== null ? (storedValue.includes('http')
            ? storedValue : `/upload/images/${storedValue}`) : null;
        }
    },
    isLocal: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },

    isRetentionAgent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    classification: {
        type: DataTypes.ENUM('otro', 'mediano', 'gran', 'ninguno'),
        set(value){
            value = String.prototype.toUpperCase.call(value);
            let vals = {
                'OTRO': 'otro',
                'OTRO CONTRIBUYENTE': 'otro',
                'PEQUEÑO': 'otro',
                'PEQUEÑO CONTRIBUYENTE': 'otro',
                'PEQUENIO CONTRIBUYENTE': 'otro',
                'PEQUENIO': 'otro',
                'MEDIANO': 'mediano',
                'MEDIO': 'mediano',
                'MEDIO CONTRIBUYENTE': 'mediano',
                'MEDIANO CONTRIBUYENTE': 'mediano',
                'GRANDE': 'gran',
                'GRAN': 'gran',
                'GRANDE CONTRIBUYENTE': 'gran',
                'GRAN CONTRIBUYENTE': 'gran',
                'NINGUNO': 'ninguno',
                'NO CLASIFICADO': 'ninguno',
            }
            this.setDataValue('classification', vals[value] !== undefined ? vals[value] : 'ninguno');
        },
        // get(){
        //     let vals = {
        //         'otro': 'Otro Contribuyente',
        //         'mediano': 'Mediano Contribuyente',
        //         'gran': 'Gran Contribuyente',
        //         'ninguno': 'No Clasificado',
        //     };
        //     const storedValue = this.getDataValue('classification');
        //     return vals[storedValue];
        // }
        
    },
    createdBy: DataTypes.STRING,
    web: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    direction: DataTypes.STRING(500),
    balance: DataTypes.DECIMAL(10, 2),
    delivery_locations:{ 
        type: DataTypes.TEXT,
        get() {
            let locations = this.getDataValue('delivery_locations');
            return locations !== null && locations !== '[]' ? JSON.parse(locations) : [];
        },
        set(param) {
            this.setDataValue('delivery_locations', param == null ? null : JSON.stringify(param) );
        }
    },
}, {
    tableName: 'inventory_provider',
});

// Provider.hasMany(Product);
// Product.belongsTo(Provider);
// Project.hasMany(Task, {
//     foreignKey: 'projectId',
//     sourceKey: 'id'
// });

// Task.belongsTo(Project, {
//     foreignKey: 'projectId',
//     targetId: 'id'
// })

module.exports = Provider;