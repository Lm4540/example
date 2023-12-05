const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const SaleReleaseRequest = sequelize.define('SaleReleaseRequest', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    sale: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
    },
    sale_detail: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    reason: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
}, {
    tableName: 'crm_sale_release_request',
});


module.exports = SaleReleaseRequest;