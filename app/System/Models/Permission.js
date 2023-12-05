const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const Permission = sequelize.define('Permission', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    name: { type: DataTypes.STRING(150) },
    group: { type: DataTypes.STRING(25) },
    explication: { type: DataTypes.STRING(300) }
}, {
    tableName: 'system_role_permission',
});

module.exports = Permission;