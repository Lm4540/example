const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


const DTE = sequelize.define('DTE', {
      id: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
      },

      sale: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true
      },
      sucursal: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true
      },
      caja: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true
      },
      codigo: {
            type: DataTypes.STRING(255),
            allowNull: false,

      },
      contingencia: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: null,

      },
      tipo: {
            type: DataTypes.STRING(10),
            allowNull: false,
      },
      trasnmitido: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
      },
      entregado: {
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
      correlativo:DataTypes.INTEGER.UNSIGNED,
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
      intentos : {
            type: DataTypes.INTEGER.UNSIGNED,
            defaultValue: 1,
      },
      _errors :{
            type: DataTypes.TEXT,
            defaultValue: null,
            get() {
                  let _string = this.getDataValue('_errors');
                  return _string !== null && _string !== undefined ? JSON.parse(_string) : null;
            },
            set(param) {
                  this.setDataValue('_errors', param == null ? null : JSON.stringify(param));
            }
      }
}, {
      tableName: 'crm_dte',
});
module.exports = DTE;


/*


create table crm_dte(
      id int unsigned AUTO_INCREMENT PRIMARY key,
      sale int unsigned null,
    codigo varchar(255),
    contingencia varchar(255) null,
    tipo varchar(10),
    trasnmitido char(1) DEFAULT "0",
    entregado char(1) DEFAULT "0",
    responseMH text null,
    dte text
);

*/