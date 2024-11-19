const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


const Catalog = sequelize.define('Catalog', {
      id: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
      },
      name: DataTypes.STRING,
      expires: DataTypes.DATE,
      active: DataTypes.BOOLEAN,
      selective: { type: DataTypes.BOOLEAN, defaultValue: 0 },
      image: DataTypes.STRING,
      createdBy: DataTypes.STRING,
      updatedBy: DataTypes.STRING,

}, {
      tableName: 'web_catalog',
});


module.exports = Catalog;


