
const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


const CatalogAccess = sequelize.define('CatalogAccess', {
      catalog: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
      },
      client: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
      },
      access: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
      }

}, {
      tableName: 'web_catalog_access',
      timestamps: false,
});


module.exports = CatalogAccess;


