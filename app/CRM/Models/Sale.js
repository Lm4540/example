const { Sequelize, DataTypes, DECIMAL } = require("sequelize");
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
    },
    type: {
        type: DataTypes.ENUM('minor', 'major'),
        defaultValue: 'minor',
    },
    delivery_type: {
        type: DataTypes.ENUM('local', 'local_delivery', 'delivery','percel'),
        defaultValue: 'local',
    },
    delivery_direction: DataTypes.STRING(500),
    delivery_contact: DataTypes.STRING,
    delivery_instructions: DataTypes.STRING(500),
    delivery_date: {
        type: DataTypes.DATE,
    },
    delivery_time: {
        type: DataTypes.TIME,
    },
    delivery_amount: DataTypes.DECIMAL(10,2),
    delivery_provider: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
    },
    delivered_by: DataTypes.STRING(100),
    revoked_at: {type: DataTypes.DATE,},
    revoked_reason: DataTypes.STRING,
    balance: {
        type: DataTypes.DECIMAL(10,2), 
        defaultValue:0.00, 
        get(){
            let _val = Number.parseFloat(this.getDataValue('balance'));
            return isNaN(_val) ? 0.00 : _val
        }
    },
    collected: {
        type: DataTypes.DECIMAL(10,2), 
        defaultValue:0.00, 
        get(){
            let _val = Number.parseFloat(this.getDataValue('collected'));
            return isNaN(_val) ? 0.00 : _val
        }
    },
    cost: {
        type: DataTypes.DECIMAL(10,2), 
        defaultValue:0.00, 
        get(){
            let _val = Number.parseFloat(this.getDataValue('cost'));
            return isNaN(_val) ? 0.00 : _val
        }
    },
    label:{
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    package_image: DataTypes.STRING,
    resend_package_image: DataTypes.STRING,
    package_by: DataTypes.STRING(50),
    invoce_serie:DataTypes.NUMBER.UNSIGNED,
    invoice_type: DataTypes.STRING(10),
    invoice_number:DataTypes.NUMBER.UNSIGNED,
    invoice_resume: DataTypes.TEXT,
    invoice_data:{ 
        type: DataTypes.TEXT,
        get() {
            let prefe = this.getDataValue('invoice_data');
            return prefe !== null && prefe !== undefined ? JSON.parse(prefe) : null;
        },
        set(param) {
            this.setDataValue('invoice_data', param == null ? null : JSON.stringify(param) );
        }
    },
    payments: { 
        type: DataTypes.TEXT,
        get() {
            let prefe = this.getDataValue('payments');
            return (prefe !== null && prefe !== undefined) ? JSON.parse(prefe) : [];
        },
        set(param) {
            this.setDataValue('payments', JSON.stringify(param == null ? [] : param) );
        }
    },
    dte: DataTypes.TEXT,
}, {
    tableName: 'crm_sale',
});

Sale.hasMany(SaleDetail, {
    foreignKey: 'sale',
    sourceKey: 'id'
});

SaleDetail.belongsTo(Sale, {
    foreignKey: 'product',
    targetId: 'id'
})



module.exports = Sale;