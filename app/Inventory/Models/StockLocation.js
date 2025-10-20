const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

module.exports = sequelize.define('StockLocation', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    product: {
        type: DataTypes.INTEGER.UNSIGNED,
    },
    sucursal: {
        type: DataTypes.INTEGER.UNSIGNED,
    },
    createdBy: {
        type: DataTypes.STRING(255)
    },
    location: {
        type: DataTypes.STRING(255)
    },
}, {
    tableName: 'inventory_product_stock_locations',
    timestamps: true,
});;

// create table inventory_product_stock_locations(
// 	id int unsigned AUTO_INCREMENT PRIMARY KEY,
// 	sucursal int unsigned,
//     product int unsigned,
//     location varchar(255),
//     createdBy varchar(255),
//     createdAt datetime NOT NULL,
//   	updatedAt datetime NOT NULL
// )ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci; 
