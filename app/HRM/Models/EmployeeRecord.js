const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const EmployeeRecord = sequelize.define('EmployeeRecord', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    employee: DataTypes.INTEGER.UNSIGNED,
    title: DataTypes.STRING,
    _text: DataTypes.TEXT,
    document: DataTypes.STRING,
    createdBy: DataTypes.STRING,
    _data: { 
        type: DataTypes.TEXT,
        get() {
            let param = this.getDataValue('_data');
            return param !== null && param !== '[]' ? JSON.parse(param) : [];
        },
        set(param) {
            this.setDataValue('_data', param == null || !Array.isArray(param) ? null : JSON.stringify(param) );
        }
    },
}, {
    tableName: 'hrm_employee_record',
});

module.exports = EmployeeRecord;