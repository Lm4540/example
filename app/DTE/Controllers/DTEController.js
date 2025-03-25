const Client = require('../Models/Client');
const Sale = require('../Models/Sale');
const Employee = require('../../HRM/Models/Employee');
const { Op, QueryTypes } = require("sequelize");
const Helper = require('../../System/Helpers');
const sequelize = require('../../DataBase/DataBase');
const Product = require('../../Inventory/Models/Product');
const Sucursal = require('../../Inventory/Models/Sucursal');
const SalePayment = require('../Models/SalePayment');



module.exports =  {

      posMode: (req, res) => {
            return res.render('POS/pos');
      },
};