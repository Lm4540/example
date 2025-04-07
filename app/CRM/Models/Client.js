const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


const Contact = require('./Contact');
const Budget = require('./Budget');
const BudgetDetail = require('./BudgetDetail');
const Invoice = require('./Invoice');
const InvoiceDetail = require('./InvoiceDetail');
const InvoiceSerie = require('./InvoiceSerie');
const PriceList = require('./PriceList');
const PriceListDetail = require('./PriceListDetail');
const Sale = require('./Sale');
const SaleDetail = require('./SaleDetail');

const Client = sequelize.define('Client', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        set(value) {
            this.setDataValue('name', value.replace(/['"]+/g, '').trim());
        },
    },
    type: {
        type: DataTypes.ENUM('minor', 'major'),
        defaultValue: 'minor',
    },
    NIT_DUI: {
        type: DataTypes.STRING
    },
    NRC: {
        type: DataTypes.STRING
    },
    isLocal: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    isRetentionAgent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    has_web_access: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    web_products: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    classification: {
        type: DataTypes.ENUM('otro', 'mediano', 'gran', 'ninguno'),

    },
    createdBy: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    direction: {
        type: DataTypes.STRING(500),
        set(value) {
            if (value) {

                this.setDataValue('direction', value.replace(/['"*]+/g, '').trim());
            }
        },
    },
    balance: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        get() {
            let _val = Number.parseFloat(this.getDataValue('balance'));
            return isNaN(_val) ? 0.00 : _val
        }
    },
    payments: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        get() {
            let _val = Number.parseFloat(this.getDataValue('payments'));
            return isNaN(_val) ? 0.00 : _val
        }
    },
    seller: DataTypes.INTEGER.UNSIGNED,
    sucursal: DataTypes.INTEGER,
    giro: DataTypes.STRING(255),
    codActividad: DataTypes.STRING(6),
    departamento: DataTypes.STRING(4),
    municipio: DataTypes.STRING(2),
    nombreComercial: DataTypes.STRING(200),
    tipoDocumento: DataTypes.STRING(2),
    nit: {
        type: DataTypes.VIRTUAL,
        get() {
            return this.tipoDocumento == "36" ? this.NIT_DUI : null;
        },
        set(value) {
            this.tipoDocumento = "36";
            this.NIT_DUI = value;
        },
    },

    nrc: {
        type: DataTypes.VIRTUAL,
        get() {
            return this.NRC;
        },
        set(value) {
            this.NRC = value;
        },
    },

    nombre: {
        type: DataTypes.VIRTUAL,
        get() {
            return this.name;
        },
    },

    descActividad: {
        type: DataTypes.VIRTUAL,
        get() {
            return this.giro;
        },
        set(value) {
            this.giro = value;
        },
    },
    direccion: {
        type: DataTypes.VIRTUAL,
        get() {

            return this.departamento != null ? {
                'departamento': this.departamento,
                'municipio': this.municipio,
                'complemento': this.direction
            } : null;

        }
    },
    telefono: {
        type: DataTypes.VIRTUAL,
        get() {
            return this.phone;
        },
        set(value) {
            this.phone = value;
        },
    },
    correo: {
        type: DataTypes.VIRTUAL,
        get() {
            return this.email;
        },
        set(value) {
            this.email = value;
        },
    },

    for_ccf_dte: {
        type: DataTypes.VIRTUAL,
        get() {
            return {
                "nit": this.nit ? this.nit.replace(/[^0-9]/g, '') : null,
                "nrc": this.nrc ? this.nrc.replace(/[^0-9]/g, '') : null,
                "nombre": this.name,
                "codActividad": this.codActividad,
                "descActividad": this.giro,
                "nombreComercial": this.nombreComercial,
                "direccion": this.direccion,
                "telefono": this.telefono ? this.telefono.replace(/[^0-9]/g, '') : null,
                "correo": this.email
            }
        }
    },
    for_fc_dte: {
        type: DataTypes.VIRTUAL,
        get() {

            let data = {
                'tipoDocumento': null,
                'numDocumento': null,
                "nrc": null,
                "nombre": this.name,
                "codActividad": this.codActividad,
                "descActividad": this.giro,
                "direccion": this.direccion,
                "telefono": this.telefono ? this.telefono.replace(/[^0-9]/g, '') : null,
                "correo": this.email
            }

            if (["36", "13", "02", "03", "37"].includes(this.tipoDocumento)) {
                data.tipoDocumento = this.tipoDocumento;
                data.numeroDocumento = this.NIT_DUI ? this.NIT_DUI.replace(/[^0-9]/g, '') : null;
            }


            return data;
        }
    }
}, {
    tableName: 'crm_client',
});


module.exports = Client;


// alter table `crm_client` add codActividad varchar(6) null, add departamento varchar(4) null, add municipio varchar(2) null, add nombreComercial varchar(200) null, add tipoDocumento varchar(2) null;