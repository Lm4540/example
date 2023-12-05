const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const PettyCashMoves = sequelize.define('PettyCashMoves', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    amount: {
        type: DataTypes.DECIMAL(10,2), 
        defaultValue:0.00, 
        get(){
            let _val = Number.parseFloat(this.getDataValue('amount'));
            return isNaN(_val) ? 0.00 : _val
        }
    },
    last_amount: {
        type: DataTypes.DECIMAL(10,2), 
        defaultValue:0.00, 
        get(){
            let _val = Number.parseFloat(this.getDataValue('last_amount'));
            return isNaN(_val) ? 0.00 : _val
        }
    },
    concept: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    petty_cash: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
    },
    type: {
        type: DataTypes.ENUM('invoice','sale', 'refill','purchase','payment', 'extra'),
    },
    isin: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    createdBy: DataTypes.STRING,
    asigned_to: DataTypes.STRING,
    _number: DataTypes.INTEGER,
    is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
}, {
    tableName: 'financial_petty_cash_moves',
});


module.exports = PettyCashMoves;