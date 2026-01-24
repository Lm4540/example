const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const Warning = sequelize.define('Warning', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  usuario: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  tipo: {
    type: DataTypes.ENUM('sistema', 'violacion', 'error', 'permiso', 'caida'),
    allowNull: false
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  proceso: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  usuario_auditado: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  revisado: {
    type: DataTypes.BOOLEAN, // Sequelize maneja el TINYINT(1) automáticamente
    allowNull: false,
    defaultValue: false
  }
}, {
  // Opciones del modelo
  tableName: 'system_warnings',
  timestamps: true, // Esto crea y maneja automáticamente createdAt y updatedAt
  collate: 'utf8mb4_spanish2_ci' // Asegura el uso correcto del español a nivel de ORM
});

module.exports = Warning;