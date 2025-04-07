const Sucursal = require('../../Inventory/Models/Sucursal');
const Client = require("../Models/Client");
const Sale = require('../Models/Sale');
const SaleDetail = require('../Models/SaleDetail');
const SalePayment = require('../Models/SalePayment');
const Product = require('../../Inventory/Models/Product');
const Stock = require('../../Inventory/Models/Stock');
const StockReserve = require('../../Inventory/Models/StockReserve');
const Movement = require("../../Inventory/Models/Movement");
const PettyCashMoves = require('../../Financial/Models/PettyCashMoves');
const Employee = require('../../HRM/Models/Employee');

const Helper = require('../../System/Helpers');
const sequelize = require("../../DataBase/DataBase");
const { Op, QueryTypes } = require("sequelize");
const path = require('path');
const fs = require('fs');

const status = {
    'process': 'En Proceso',
    'prepared': "Paquete Preparado",
    'transport': "En Ruta",
    'delivered': 'Entregado',
    'collected': "Pago Recibido",
    'revoking': "Revocando / Liberando",
    'revoked': "Revocado",
    'delivery_failed': "Entrega Fallida",
    'to_resend': "Marcado para reenvio",
    'closed': 'Cerrado'
};

module.exports = {

    posMode: (req, res) => {

        let distritos = require('../../DTE/Catalogos/distritos.json').values;

        let formated_districts = [];


        distritos.forEach(district => {
            formated_districts.push({
                value: district.value,
                label: district.label,
                customProperties: {
                    departamento: district.departamento,
                    municipio: district.municipio,
                }
            })
        });
        //buscar los datos de las ventas cerradas y pendiented de facturar

        //buscar los datos de las ventas pendientes de elaboracion de guias


        //ventas con numero de paquetes cobrados
return res.json(formated_districts);
        // return res.render('POS/pos', { pageTitle: 'Faturación y Cobro' });
    },

    getData: (req, res) => {

    },

    //get
    searchSale: (req, res) => {
        //buscr y devoolver la venta Generada
    },

    // post
    createSale: (req, res) => {

    }

};