const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const RequisitionDetail = sequelize.define('RequisitionDetail', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    requisition: {
        type: DataTypes.INTEGER.UNSIGNED
    },
    product: {
        type: DataTypes.INTEGER.UNSIGNED
    },
    cant: {
        type: DataTypes.INTEGER.UNSIGNED,
        get() { return Number.parseInt(this.getDataValue('cant')) }
    },
    createdBy: DataTypes.STRING,
    client: {
        type: DataTypes.INTEGER.UNSIGNED
    },
    client_name: DataTypes.STRING,
    user: {
        type: DataTypes.INTEGER.UNSIGNED
    },
    sale_detail: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
    },
}, {
    tableName: 'inventory_requisition_detail',
});

module.exports = RequisitionDetail;
