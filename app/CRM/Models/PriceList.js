const { Sequelize, DataTypes} = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


//invoice pendiente de revision
const PriceList = sequelize.define('PriceList', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    name: DataTypes.STRING,
    init_date: DataTypes.DATE,
    end_date: DataTypes.DATE,
}, {
    tableName: 'crm_pricelist',
});

module.exports = PriceList;