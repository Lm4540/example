const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");
// const Product = require('./Product');

const RecountAreaDetail = sequelize.define('RecountAreaDetail', {
      id: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
      },
      area:  DataTypes.INTEGER.UNSIGNED,
      product:  DataTypes.INTEGER.UNSIGNED,
      cant:  DataTypes.INTEGER.UNSIGNED,
      createdBy: DataTypes.STRING(50),
}, {
      tableName: 'inventory_recount_area_detail',
});

module.exports = RecountAreaDetail;

// create table inventory_recount_area_detail(
//       id int unsigned AUTO_INCREMENT primary key,
//    area int unsigned not null,
//    product int unsigned not null,
//    cant int unsigned not null default 1,
//    createdBy varchar(50),
//    createdAt datetime,
//    updatedAt datetime
// )ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;