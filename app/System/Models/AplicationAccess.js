const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


const AplicationAccess = sequelize.define('AplicationAccess', {
      identification: {
            type: DataTypes.STRING(255),
            allowNull: false,
            primaryKey: true,
      },
      secret: DataTypes.STRING(255),
      permissions: {
            type: DataTypes.TEXT,
            get() {
                  let perm = this.getDataValue('specialPermission');
                  return perm !== null && perm !== '[]' ? JSON.parse(perm) : [];
            },
            set(param) {
                  this.setDataValue('specialPermission', (param == null || !Array.isArray(param)) ? null : JSON.stringify(param));
            }
      },
      appName: DataTypes.STRING,
      createdBy: DataTypes.STRING,
      _status: {
            type: DataTypes.ENUM('on', 'off', 'blocked', 'role_off'),
            defaultValue: 'on',
      },
}, {
      tableName: 'system_aplications',
});


module.exports = AplicationAccess;


