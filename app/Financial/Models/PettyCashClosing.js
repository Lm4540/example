const { DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");
const { get } = require("memory-cache");

const PettyCashClosing = sequelize.define('PettyCashClosing', {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      petty_cash_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      system_balance: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      physical_balance: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      consigned_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      difference: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      denominations: {
            allowNull: false,
            type: DataTypes.TEXT,
            get() {
                  const rawValue = this.getDataValue('denominations');
                  if (!rawValue) return {};
                  if (typeof rawValue === 'object') return rawValue;
                  try {
                        return JSON.parse(rawValue);
                  } catch (e) {
                        return {};
                  }
            },
            set(param) {
                  this.setDataValue('denominations', JSON.stringify(param == null ? {} : param));
            }
      },
      cashier_user: { type: DataTypes.STRING, allowNull: false },
      verifier_user: { type: DataTypes.STRING, allowNull: false },
      notes: DataTypes.TEXT,
      status: {
            type: DataTypes.ENUM('Pendiente', 'Verificado', 'Rechazado'),
            defaultValue: 'Pendiente'
      },
      verifiedAt: {
            type: DataTypes.DATE,
            allowNull: true
      }
}, {
      tableName: 'financial_petty_cash_closings',
      timestamps: true,
      updatedAt: false
});

module.exports = PettyCashClosing;