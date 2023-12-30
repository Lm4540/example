const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const ModelHistory = sequelize.define('ModelHistory', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    model: { type: DataTypes.STRING(150) },
    model_id: DataTypes.INTEGER.UNSIGNED,
    history: {
        type: DataTypes.TEXT,
        get() {
            let prefe = this.getDataValue('history');
            return prefe !== null && prefe !== undefined ? JSON.parse(prefe) : null;
        },
        set(param) {
            this.setDataValue('history', param == null ? null : JSON.stringify(param));
        }
    },
}, {
    tableName: 'system_model_history',
});

module.exports = ModelHistory;