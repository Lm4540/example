const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

// import { Task } from "./Task.js";

module.exports = sequelize.define('Sucursal', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    location: {
        type: DataTypes.STRING(255),
    },
    mapLink: {
        type: DataTypes.VIRTUAL,
        get() {
            return null;
        }
    },
    balance: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        get() {
            let _val = Number.parseFloat(this.getDataValue('balance'));
            return isNaN(_val) ? 0.00 : _val
        }
    },
    hasAreas: {
        type: DataTypes.VIRTUAL,
        get() {
            return true;
        }
    },
    isWharehouse: {
        type: DataTypes.VIRTUAL,
        get() {
            return true;
        }
    },
    isSalesRoom: {
        type: DataTypes.VIRTUAL,
        get() {
            return true;
        }
    },
    abreviation: DataTypes.STRING(10),
    departamento: DataTypes.STRING(10),
    municipio: DataTypes.STRING(10),
    tipoEstablecimiento: DataTypes.STRING(10),
    codEstableMH: DataTypes.STRING(10),
    codEstable: DataTypes.STRING(10),
    direccion: {
        type: DataTypes.VIRTUAL,
        get() {
            return {
                "departamento": this.departamento,
                "municipio": this.municipio,
                "complemento": this.location
            };
        }

    },
    dte_emisor:{
        type: DataTypes.VIRTUAL,
        get(){
            return {
                nit: process.env.COMPANY_NIT,
                nrc: process.env.COMPANY_NRC,
                nombre: process.env.COMPANY_LEGAL_NAME,
                codActividad: process.env.COD_ACTIVIDAD,
                descActividad: process.env.DESC_ACTIVIDAD,
                nombreComercial: process.env.COMPANY_NAME,
                tipoEstablecimiento: this.tipoEstablecimiento,
                direccion: this.direccion,
                telefono: process.env.COMPNY_TEL,
                correo: process.env.COMPANY_EMAIL,
                codEstableMH: this.codEstableMH,
                codEstable: this.codEstable,
                codPuntoVentaMH: null,
                codPuntoVenta: null,             
            }
        }
        
    },
    for_nc_dte:{
        type: DataTypes.VIRTUAL,
        get(){
            return {
                nit: process.env.COMPANY_NIT,
                nrc: process.env.COMPANY_NRC,
                nombre: process.env.COMPANY_LEGAL_NAME,
                codActividad: process.env.COD_ACTIVIDAD,
                descActividad: process.env.DESC_ACTIVIDAD,
                nombreComercial: process.env.COMPANY_NAME,
                tipoEstablecimiento: this.tipoEstablecimiento,
                direccion: this.direccion,
                telefono: process.env.COMPNY_TEL,
                correo: process.env.COMPANY_EMAIL,
            }
        }
        
    },
    for_fse_dte:{
        type: DataTypes.VIRTUAL,
        get(){
            return {
                nit: process.env.COMPANY_NIT,
                nrc: process.env.COMPANY_NRC,
                nombre: process.env.COMPANY_LEGAL_NAME,
                codActividad: process.env.COD_ACTIVIDAD,
                descActividad: process.env.DESC_ACTIVIDAD,
                direccion: this.direccion,
                telefono: process.env.COMPNY_TEL,
                correo: process.env.COMPANY_EMAIL,
                codEstableMH: this.codEstableMH,
                codEstable: this.codEstable,
                codPuntoVentaMH: null,
                codPuntoVenta: null
            }
        }
        
    },

}, {
    tableName: 'system_sucursal',
});