const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const SaleDetail = sequelize.define('SaleDetail', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    sale: DataTypes.INTEGER.UNSIGNED,
    product: DataTypes.INTEGER.UNSIGNED,

    price:{
        type: DataTypes.DECIMAL(10,2), 
        defaultValue:0.00, 
        get(){
            let _val = Number.parseFloat(this.getDataValue('price'));
            return isNaN(_val) ? 0.00 : _val
        }
    },
    description: DataTypes.TEXT,
    image: {
        type: DataTypes.STRING,
        get() {
            const storedValue = this.getDataValue('image');
            return storedValue !== null ?
                (storedValue.includes('http') ? storedValue : `/upload/images/${storedValue}`) :
                '/upload/images/image-not-found.png';
        }
    },
    img: {
        type: DataTypes.VIRTUAL,
        get() {
            return this.getDataValue('image');
        }
    },
    _order: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: false,
    },
    cant: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    ready: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
    },
    delivered: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
    },
    reserved: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
    },
    from_translate: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
    },
    requisition_detail: {
        type: DataTypes.INTEGER,
    },
    product_cost: {
        type: DataTypes.DECIMAL(10,2), 
        defaultValue:0.00, 
        get(){
            let _val = Number.parseFloat(this.getDataValue('product_cost'));
            return isNaN(_val) ? 0.00 : _val
        }
    },

    history:  { 
        type: DataTypes.TEXT,
        get() {
            let prefe = this.getDataValue('history');
            return (prefe !== null && prefe !== undefined) ? JSON.parse(prefe) : new Array();
        },
        set(param) {
            this.setDataValue('history', JSON.stringify(param == null ? new Array() : param) );
        }
    },
    invoice_column: {
        type: DataTypes.ENUM,
        values: ['gravado', 'exento', 'no_sujeto'],
        defaultValue: 'gravado'
    }


}, {
    indexes: [],
    tableName: 'crm_sale_detail',
    timestamps: true,
});




module.exports = SaleDetail;