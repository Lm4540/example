const Helper = require('../../System/Helpers');
const Money = require('../../System/Money');
const sequelize = require("../../DataBase/DataBase");
const { Op, QueryTypes } = require("sequelize");
const path = require('path');
const fs = require('fs');

const Sucursal = require('../../Inventory/Models/Sucursal');
const Product = require('../../Inventory/Models/Product');
const Client = require("../../CRM/Models/Client");
const Catalog = require("../Models/Catalog");
const CatalogDetail = require("../Models/CatalogDetail");
const ProductClassification = require('../../Inventory/Models/ProductClassification');


const ApiController = {

      // funciones para que se conecten los clientes
      clientAutentication: async (req, res) => {

      },


      clientGetData: async (req, res) => {
            //Proporcionar los datos del cliente



            switch (req.params.option) {
                  case 'data':
                        //Devolver la data del cliente                        
                        break;

                  case 'history':
                        //Devolver la data del cliente                        
                        break;

                  default:
                        break;
            }
      },

      clientUpdateData: async (req, res) => {
            //Proporcionar los datos del cliente
            switch (req.params.option) {
                  case 'info':
                        //Devolver la data del cliente                        
                        break;

                  case 'solicitud':
                        //Devolver la data del cliente                        
                        break;

                  default:
                        break;
            }
      },



      // /api/v1/catalogs/client/:id
      getCatalogs: async (req, res) => {
            //buscar la informacion de los catalogos activos


            //retornar los catalogos que tenga activos el cliente que consulta en ese momento
      },

      catalogDetails: async (req, res) => {
            //obtener los detalles de un catalogo

            //retornar los detalles del catalogo
      },
      productDetails: async (req, res) => {
            //obtener los detalles de un producto


      },





};

module.exports = ApiController;