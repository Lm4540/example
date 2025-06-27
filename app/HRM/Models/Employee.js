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
    shortName: DataTypes.STRING,
    nickname: DataTypes.STRING,
    municipio: {
        type: DataTypes.STRING(2),
        defaultValue: null
    },
    departamento: {
        type: DataTypes.STRING(2),
        defaultValue: null
    },
    distrito: {
        type: DataTypes.STRING(50),
        defaultValue: null
    }
}, {
    tableName: 'hrm_employee',
});

// alter table `hrm_employee` add municipio char(2), add departamento char(2), add distrito varchar(50);
// ALTER TABLE crm_client add distrito varchar(50);

module.exports = Employee;