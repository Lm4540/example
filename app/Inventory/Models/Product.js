const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");
const Stock = require("./Stock");
const Movements = require("./Movements");
const ProductClassification = require("./ProductClassification");
const Provider = require("./Provider");


const Product = sequelize.define('Product', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING
    },
    provider_code: {
        type: DataTypes.STRING
    },
    internal_code: {
        type: DataTypes.STRING
    },
    type: {
        type: DataTypes.ENUM('product', 'material'),
        defaultValue: 'product',
    },
    client_description: {
        type: DataTypes.STRING
    },
    description: {
        type: DataTypes.STRING
    },
    classification: {
        type: DataTypes.INTEGER.UNSIGNED
    },
    provider: {
        type: DataTypes.INTEGER.UNSIGNED
    },
    min_stock: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
    },
    max_stock: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 10,
    },
    stock: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
    },
    reserved: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
    },
    image: {
        type: DataTypes.STRING,
        get() {
            const storedValue = this.getDataValue('image');
            return storedValue !== null ?
                (storedValue.includes('http') ? storedValue : `/upload/images/${storedValue}`) :
                '/upload/images/image-not-found.png';
        }
    },
    raw_image_name: {
        type: DataTypes.VIRTUAL,
        get() {
            return this.getDataValue('image')
        },
        set(value) {
            throw new Error('Do not try to set the `fullName` value!');
        }
    },
    sku: {
        type: DataTypes.VIRTUAL,
        get() {
            return this.getDataValue('internal_code')
        },
    },
    cost: {
        type: DataTypes.DECIMAL(10, 2)
    },
    last_cost: {
        type: DataTypes.DECIMAL(10, 2)
    },
    base_price: {
        type: DataTypes.DECIMAL(10, 2)
    },
    major_price: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
    },
    price: {
        type: DataTypes.VIRTUAL,
        get() {
            return new Intl.NumberFormat('es-SV', { style: "decimal", currency: "USD", minimumFractionDigits: 2 }).format(this.getDataValue('base_price'));
        },
        set(value) {
            throw new Error('Do not try to set the `fullName` value!');
        }
    },
    major: {

        type: DataTypes.VIRTUAL,
        get() {
            return new Intl.NumberFormat('es-SV', { style: "decimal", currency: "USD", minimumFractionDigits: 2 }).format(this.getDataValue('major_price'));
        },
        set(value) {
            throw new Error('Do not try to set the `fullName` value!');
        }
    },
    createdBy: DataTypes.STRING,
    available_for_sale: DataTypes.BOOLEAN,
    parent_product: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
    },
    color: DataTypes.STRING(25),
}, {
    tableName: 'inventory_product',
});

// Product.hasMany(Stock, {
//     foreignKey: 'product',
//     sourceKey: 'id'
// });

// Stock.belongsTo(Product, {
//     foreignKey: 'product',
//     targetId: 'id'
// })


module.exports = Product;
// alter table `inventory_product` add color varchar(25), add parent_product int unsigned null