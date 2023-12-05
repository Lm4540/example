const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const Contact = sequelize.define('Contact', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    job: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    direction: DataTypes.STRING,
    type: {
        type: DataTypes.ENUM('client', 'provider', 'secure_employee'),
        defaultValue: 'client'
    },
    
}, {
    tableName: 'crm_contact',
});

module.exports = Contact;