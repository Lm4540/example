const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const History = sequelize.define('History', {
      id: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
      },
      resource_id: DataTypes.INTEGER.UNSIGNED,
      author: DataTypes.STRING(50),
      resource: DataTypes.STRING(25),
      ref: DataTypes.STRING(255)
}, {
      tableName: 'system_history',
});


module.exports = History;


/*create table system_history(id int unsigned PRIMARY key AUTO_INCREMENT, resource_id int unsigned, author varchar(50), createdAt datetime, updatedAt datetime, resource varchar(25), ref varchar(255)) ENGINE = InnoDB DEFAULT CHARSET = utf8mb3 COLLATE = utf8mb3_spanish_ci;*/