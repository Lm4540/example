const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


const FailedDte = sequelize.define('FailedDte', {
      id: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
      },
      _request: {
            type: DataTypes.TEXT,
            get() {
                  let _string = this.getDataValue('_request');
                  return _string !== null && _string !== undefined ? JSON.parse(_string) : null;
            },
            set(param) {
                  this.setDataValue('_request', param == null ? null : JSON.stringify(param));
            }
      },
      _user: DataTypes.STRING,
      opt:DataTypes.STRING,
      verified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
      },
      responseMH: {
            type: DataTypes.TEXT,
            get() {
                  let _string = this.getDataValue('responseMH');
                  return _string !== null && _string !== undefined ? JSON.parse(_string) : null;
            },
            set(param) {
                  this.setDataValue('responseMH', param == null ? null : JSON.stringify(param));
            }
      },
      dte: {
            type: DataTypes.TEXT,
            get() {
                  let _string = this.getDataValue('dte');
                  return _string !== null && _string !== undefined ? JSON.parse(_string) : null;
            },
            set(param) {
                  this.setDataValue('dte', param == null ? null : JSON.stringify(param));
            }
      },
}, {
      tableName: 'crm_dte_failed',
});
module.exports = FailedDte;



