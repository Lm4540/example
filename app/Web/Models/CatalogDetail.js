const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


const CatalogDetail = sequelize.define('CatalogDetail', {
      id: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
      },
      product: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
      },
      catalog: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
      },
      umbral: {
            type: DataTypes.INTEGER.UNSIGNED,
            defaultValue: 0,
      },
      price: DataTypes.DECIMAL(8, 2),
      discount_price: DataTypes.DECIMAL(8, 2),
      revised: DataTypes.BOOLEAN,
      createdBy: DataTypes.STRING,
      updatedBy: DataTypes.STRING,

}, {
      tableName: 'web_catalog_details',
});


module.exports = CatalogDetail;