const { Sequelize, DataTypes} = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


const PriceListDetail = sequelize.define('PriceListDetail', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    product: DataTypes.INTEGER.UNSIGNED,
    pricelist: DataTypes.INTEGER.UNSIGNED,
    price: DataTypes.DECIMAL(10,2),
}, {
    tableName: 'crm_pricelist_detail',
});

module.exports = PriceListDetail;