const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const SalePayment = sequelize.define('SalePayment', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    client: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    sales: { 
        type: DataTypes.TEXT,
        get() {
            let prefe = this.getDataValue('sales');
            return prefe !== null && prefe !== undefined ? JSON.parse(prefe) : [];
        },
        set(param) {
            this.setDataValue('sales', param == null ? null : JSON.stringify(param) );
        }
    },

    type: {
        type: DataTypes.ENUM('money', 'credit_card', 'transfer'),
        defaultValue: 'money',
    },
    amount: {
        type: DataTypes.DECIMAL(10,2), 
        defaultValue:0.00, 
        get(){
            let _val = Number.parseFloat(this.getDataValue('amount'));
            return isNaN(_val) ? 0.00 : _val
        }
    },
    asigned_amount: {
        type: DataTypes.DECIMAL(10,2), 
        defaultValue:0.00, 
        get(){
            let _val = Number.parseFloat(this.getDataValue('asigned_amount'));
            return isNaN(_val) ? 0.00 : _val
        }
    },
    bank: DataTypes.STRING,
    reference: DataTypes.STRING,
    createdBy: DataTypes.STRING
}, {
    tableName: 'crm_sale_payment',
});

module.exports = SalePayment;