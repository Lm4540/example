const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


// import { Task } from "./Task.js";

const ProductClassification = sequelize.define('Clasification', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    image: {
        type: DataTypes.STRING,
        get() {
            const storedValue = this.getDataValue('image');
            return storedValue !== null
                ? storedValue.includes('http')
                    ? storedValue : `/upload/images/${storedValue}`
                : null;
        }
    },
    _group: {
        type: DataTypes.ENUM,
        values: ['Carteras', 'Mochilas', 'Relojes', 'Electrodomesticos', 'Tecnologia', 'Productos para el Hogar', 'Productos y accesorios para niños', 'Accesorios para dama'],
        defaultValue: 'Carteras'
    }
}, {
    tableName: 'inventory_product_classification',
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

module.exports = ProductClassification;