const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");
const SaleDetail = require('./SaleDetail');

const Sale = sequelize.define('Sale', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    client: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    seller: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    sucursal: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    credit_conditions: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
    },
    _status: {
        type: DataTypes.ENUM('process', 'prepared', 'transport', 'delivered', 'collected', 'revoking', 'revoked', 'delivery_failed', 'to_resend', 'closed'),
        defaultValue: 'process',
        set(param) {
            this.setDataValue('_status', param);
            if (param == 'collected') {
                this.setDataValue('endAt', new Date());
            }
        },
    },
    type: {
        type: DataTypes.ENUM('minor', 'major'),
        defaultValue: 'minor',
    },
    delivery_type: {
        type: DataTypes.ENUM('local', 'local_delivery', 'delivery', 'percel'),
        defaultValue: 'local',
    },
    delivery_direction: DataTypes.STRING(500),
    delivery_contact: DataTypes.STRING,
    delivery_instructions: DataTypes.STRING(500),
    delivery_date: {
        type: DataTypes.DATE,
        get() {
            let date = new Date(this.getDataValue('delivery_date'));
            date = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${this.getDataValue('delivery_time')}`;
            return new Date(date);
        },
    },
    delivery_time: {
        type: DataTypes.TIME,
    },
    delivery_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        get() {
            let _val = Number.parseFloat(this.getDataValue('delivery_amount'));
            return isNaN(_val) ? 0.00 : _val
        }
    },
    delivery_provider: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
    },
    delivered_by: DataTypes.STRING(100),
    revoked_at: { type: DataTypes.DATE, },
    revoked_reason: DataTypes.STRING,
    balance: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        get() {
            let _val = Number.parseFloat(this.getDataValue('balance'));
            return isNaN(_val) ? 0.00 : _val
        }
    },
    collected: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        get() {
            let _val = Number.parseFloat(this.getDataValue('collected'));
            return isNaN(_val) ? 0.00 : _val
        }
    },
    cost: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        get() {
            let _val = Number.parseFloat(this.getDataValue('cost'));
            return isNaN(_val) ? 0.00 : _val
        }
    },
    label: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    package_image: DataTypes.STRING,
    resend_package_image: DataTypes.STRING,
    package_by: DataTypes.STRING(50),
    invoce_serie: DataTypes.NUMBER.UNSIGNED,
    invoice_type: DataTypes.STRING(10),
    invoice_number: DataTypes.NUMBER.UNSIGNED,
    invoice_resume: DataTypes.TEXT,
    invoice_data: {
        type: DataTypes.TEXT,
        get() {
            let prefe = this.getDataValue('invoice_data');
            return prefe !== null && prefe !== undefined ? JSON.parse(prefe) : null;
        },
        set(param) {
            this.setDataValue('invoice_data', param == null ? null : JSON.stringify(param));
        }
    },
    payments: {
        type: DataTypes.TEXT,
        get() {
            let prefe = this.getDataValue('payments');
            return (prefe !== null && prefe !== undefined && prefe != '[]') ? JSON.parse(prefe) : new Array();
        },
        set(param) {
            this.setDataValue('payments', JSON.stringify(param == null ? [] : param));
        }
    },
    invoice_retention: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    invoice_isr: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    in_report: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    invoice_date: { type: DataTypes.DATE, },
   
    endAt: { type: DataTypes.DATE, },
    locked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    taxes: {
        type: DataTypes.TEXT,
        get() {
            let prefe = this.getDataValue('taxes');
            return (prefe !== null && prefe !== undefined) ? JSON.parse(prefe) : [];
        },
        set(param) {
            this.setDataValue('taxes', JSON.stringify(param == null ? [] : param));
        }
    },
     closed_date : { 
        type: DataTypes.DATE, 
        allowNull: true,
        defaultValue: null
    },
    orderTracking: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null
    },
}, {
    tableName: 'crm_sale',
    hooks: {
        beforeSave: (record, options) => {
            if (record.dataValues.locked == true || record.dataValues.locked == 1) {
                console.log('registro bloaqueado')
                return Promise.reject(new Error("Esta Venta ya ha finalizado su proceso y no puede ser actualizada!"));
            }
        },
        beforeUpdate: (record, options) => {
            if (record.dataValues.locked == true || record.dataValues.locked == 1) {
                console.log('registro bloaqueado')
                return Promise.reject(new Error("Esta Venta ya ha finalizado su proceso y no puede ser actualizada!"));
            }
        }
    }
});





module.exports = Sale;