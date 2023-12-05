const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const Employee = sequelize.define('Employee', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    name: {type: DataTypes.STRING},
    isSeller: { type: DataTypes.BOOLEAN, defaultValue: false },
    createdBy: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    direction: DataTypes.STRING(500),
    balance: DataTypes.DECIMAL(10, 2),
    NIT_DUI: DataTypes.STRING,
    _user: DataTypes.INTEGER.UNSIGNED,
    sucursal: DataTypes.INTEGER.UNSIGNED,
    image: DataTypes.STRING,
}, {
    tableName: 'hrm_employee',
});

module.exports = Employee;