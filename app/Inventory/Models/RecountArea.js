const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");
// const Product = require('./Product');

const RecountArea = sequelize.define('RecountArea', {
      id: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
      },
      recount:  DataTypes.INTEGER.UNSIGNED,
      name: DataTypes.STRING(100),
      _status : DataTypes.BOOLEAN
}, {
      tableName: 'inventory_recount_area',
});

module.exports = RecountArea;


// alter table `inventory_recount_detail` add area int unsigned not null;

// create table inventory_recount_area(
// 	id int unsigned AUTO_INCREMENT primary key,
//     _status tinyint(1) default 0,
//     recount int unsigned not null,
//     _user int unsigned,
//     verificator int unsigned,
// 	name varchar(100) not null
// )ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
