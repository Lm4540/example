const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const PurchaseDetail = sequelize.define('PurchaseDetail', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    purchase: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    cant: DataTypes.INTEGER.UNSIGNED,
    description: DataTypes.STRING,
    code: DataTypes.STRING,
    color: DataTypes.STRING,
    price:DataTypes.DECIMAL(10,2),
    cost:DataTypes.DECIMAL(10,2),
    in: DataTypes.INTEGER.UNSIGNED,
    identified: DataTypes.INTEGER,
    identification: { 
        type: DataTypes.TEXT,
        get() {
            let locations = this.getDataValue('identification');
            return locations !== null && locations !== '[]' ? JSON.parse(locations) : [];
        },
        set(param) {
            this.setDataValue('identification', param == null ? null : JSON.stringify(param) );
        }
    },
    uniMedida: DataTypes.INTEGER,
    detail_type: {
        type: DataTypes.ENUM,
        values: ['product', 'services', 'purchase_expense','sale_expense','equipment_purchase', 'factured_expense']
    },
}, {
    tableName: 'purchase_detail',
});

module.exports = PurchaseDetail;
