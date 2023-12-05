const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");


const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    role: DataTypes.INTEGER.UNSIGNED,
    email: DataTypes.STRING,
    name: DataTypes.STRING,
    password: DataTypes.STRING(400),
    specialPermission: { 
        type: DataTypes.TEXT,
        get() {
            let perm = this.getDataValue('specialPermission');
            return perm !== null && perm !== '[]' ? JSON.parse(perm) : [];
        },
        set(param) {
            this.setDataValue('specialPermission', (param == null || !Array.isArray(param)) ? null : JSON.stringify(param) );
        }
    },
    temporalPermission:{ 
        type: DataTypes.TEXT,
        get() {
            let perm = this.getDataValue('temporalPermission');
            return perm !== null && perm !== '[]' ? JSON.parse(perm) : [];
        },
        set(param) {
            this.setDataValue('temporalPermission', param == null || !Array.isArray(param) ? null : JSON.stringify(param) );
        }
    },
    temporalDate: DataTypes.DATE,
    attempts: DataTypes.INTEGER,
    createdBy: DataTypes.STRING,
    isOnline:DataTypes.BOOLEAN,
    lastConecction: DataTypes.DATE,
    comment: DataTypes.STRING(400),
    image: DataTypes.STRING,
    _status:{
        type: DataTypes.ENUM('on', 'off', 'blocked', 'role_off'),
        defaultValue: 'on',
    },
    preferences:{ 
        type: DataTypes.TEXT,
        get() {
            let prefe = this.getDataValue('preferences');
            return prefe !== null && prefe !== '[]' ? JSON.parse(prefe) : [];
        },
        set(param) {
            this.setDataValue('preferences', param == null ? null : JSON.stringify(param) );
        }
    },
}, {
    tableName: 'system_user',
});


module.exports = User;