const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


const Role = sequelize.define('Role', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    name: { type: DataTypes.STRING(50) },
    description: { type: DataTypes.STRING(400) },
    updatedBy: { type: DataTypes.STRING(50), },
    createdBy: { type: DataTypes.STRING(50), },
    permission: { 
        type: DataTypes.TEXT,
        get() {
            let perm = this.getDataValue('permission');
            return perm !== null && perm !== '[]' ? JSON.parse(perm) : [];
        },
        set(param) {
            this.setDataValue('permission', param == null || !Array.isArray(param) ? null : JSON.stringify(param) );
        }
    },
    _status: {
        type: DataTypes.ENUM('on', 'off'),
        defaultValue: 'on',
    },
    removable: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
}, {
    tableName: 'system_role',
});


module.exports = Role;