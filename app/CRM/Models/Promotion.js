const { DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");
const Product = require('../../Inventory/Models/Product');


const Promotion = sequelize.define('Promotion', {
      name: { type: DataTypes.STRING, allowNull: false },
      summary: { type: DataTypes.TEXT },
      promo_link: { type: DataTypes.STRING },
      start_date: { type: DataTypes.DATE, allowNull: false },
      end_date: { type: DataTypes.DATE, allowNull: false },
      combo_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      status: { type: DataTypes.BOOLEAN, defaultValue: true },
      createdBy: { type: DataTypes.STRING(50) },
      alternatives_allowed: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'inventory_promotion', timestamps: true });

const PromotionDetail = sequelize.define('PromotionDetail', {
      promotion_id: DataTypes.INTEGER.UNSIGNED,
      product_id: DataTypes.INTEGER.UNSIGNED,
      internal_code: { type: DataTypes.STRING(20) },
      provider_code: { type: DataTypes.STRING(20) },
      quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
      unit_cost_at_time: { type: DataTypes.DECIMAL(12, 2) },
      alternatives_allowed: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'inventory_promotion_detail', timestamps: false });

// Relaciones
Promotion.hasMany(PromotionDetail, { foreignKey: 'promotion_id', as: 'details' });
PromotionDetail.belongsTo(Promotion, { foreignKey: 'promotion_id' });
PromotionDetail.belongsTo(Product, { foreignKey: 'product_id' });

module.exports = { Promotion, PromotionDetail };

