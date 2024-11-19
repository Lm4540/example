const Helper = require('../../System/Helpers');
const Money = require('../../System/Money');
const sequelize = require("../../DataBase/DataBase");
const { Op, QueryTypes, Model } = require("sequelize");
const path = require('path');
const fs = require('fs');

const Sucursal = require('../../Inventory/Models/Sucursal');
const Product = require('../../Inventory/Models/Product');
const Client = require("../../CRM/Models/Client");
const Catalog = require("../Models/Catalog");
const CatalogDetail = require("../Models/CatalogDetail");
const ProductClassification = require('../../Inventory/Models/ProductClassification');
const CatalogAccess = require('../Models/CatalogAccess');


const CatalogController = {
      allCatalog: async (req, res) => {
            let catalogs = await Catalog.findAll();
            return res.render('Web/Catalog/index', {
                  pageTitle: 'Catalogos Web',
                  catalogs
            });

      },

      getCatalogs: async (req, res) => {
            let relations = {};
            let catalogs = null;
            if (req.query.cliente !== undefined && req.query.cliente !== null) {
                  let client = await Client.findByPk(req.query.cliente);
                  if (!client) {
                        return res.json({
                              catalogs: null,
                              access: null,
                        });
                  }
                  catalogs = await CatalogAccess.findAll({
                        where: { client: client.id }
                  });
                  catalogs.forEach(access => relations[access.catalog] = access.access);
            }
            catalogs = await Catalog.findAll({ order: [['active', 'DESC'],], });
            return res.json({ catalogs, access: relations });
      },


      createCatalog: async (req, res) => {
            let name = req.body.name;
            let catalog = await Catalog.findOne({
                  where: {
                        name: name
                  }
            });
            if (catalog) {
                  return res.json({
                        status: 'exist',
                        catalog: catalog.id
                  });
            } else {
                  catalog = await Catalog.create({
                        name,
                        expires: new Date('2030-01-01'),
                        active: false,
                        image: null,
                        createdBy: req.session.userSession.shortName,
                        updatedBy: req.session.userSession.shortName,
                  });

                  return res.json({
                        status: 'success',
                        catalog: catalog.id
                  });
            }
      },

      viewCatalog: async (req, res) => {
            let catalog = await Catalog.findByPk(req.params.id);
            if (catalog) {

                  let categories = await ProductClassification.findAll({ order: [['name', 'ASC']] });
                  let details = await sequelize.query(`SELECT * FROM inventory_product where id in (SELECT product FROM web_catalog_details WHERE catalog = ${catalog.id})`, {
                        type: QueryTypes.SELECT,
                        model: Product,
                  });
                  let products = {};
                  details.forEach(element => { products[element.id] = element; });

                  details = await CatalogDetail.findAll({
                        where: {
                              catalog: catalog.id
                        },
                        order: [
                              ['revised', 'DESC'],

                        ]
                  });

                  return res.render('Web/Catalog/view', {
                        pageTitle: catalog.name,
                        catalog,
                        categories,
                        details,
                        products
                  });
            }

            return Helper.notFound(req, res, 'catalog not found!')
      },

      addProducts: async (req, res) => {
            let catalog = await Catalog.findByPk(req.params.id);
            return res.render('Web/Catalog/addProducts', {
                  pageTitle: catalog.name,
                  catalog, limit: 10,
            });
      },

      updateCatalog: async (req, res) => {
            let createdBy = req.session.userSession.shortName;
            let catalog = await Catalog.findByPk(req.body.catalog);

            if (catalog) {
                  let detail = null;
                  let product = null;
                  switch (req.body.case) {
                        case 'add':
                              detail = await CatalogDetail.findOne({
                                    where: {
                                          product: req.body.product,
                                          catalog: catalog.id
                                    }
                              });
                              if (detail) {
                                    return res.json({
                                          status: 'exist',
                                          message: 'Agregado con éxito'
                                    });
                              } else {
                                    product = await Product.findByPk(req.body.product);
                                    if (product) {
                                          let discount_price = Number.parseFloat(req.body.discount_price);
                                          discount_price = isNaN(discount_price) || discount_price > product.major ? product.major : discount_price;

                                          try {
                                                detail = await CatalogDetail.create({
                                                      product: req.body.product,
                                                      catalog: catalog.id,
                                                      umbral: 0,
                                                      price: product.major,
                                                      discount_price,
                                                      revised: false,
                                                      createdBy,
                                                      updatedBy: createdBy,
                                                });

                                                return res.json({
                                                      status: 'success',
                                                      message: 'Agregado con éxito'
                                                });
                                          } catch (error) {
                                                return res.json({
                                                      status: 'error',
                                                      message: error.message,
                                                      error
                                                });
                                          }
                                    }

                                    return res.json({
                                          status: 'errorMessage',
                                          message: 'Producto no encontrado'
                                    });
                              }
                              break;

                        case 'update':
                              detail = await CatalogDetail.findByPk(req.body.detail);
                              if (detail) {
                                    discount_price = Number.parseFloat(req.body.discount_price);
                                    price = Number.parseFloat(req.body.price);
                                    if (isNaN(discount_price)) {
                                          discount_price = detail.price;
                                    }

                                    if (isNaN(price)) {
                                          price = detail.price;
                                    }

                                    detail.discount_price = discount_price;
                                    detail.price = price;
                                    detail.umbral = isNaN(Number.parseInt(req.body.umbral)) ? 0 : Number.parseInt(req.body.umbral);
                                    detail.revised = true;
                                    detail.updatedBy = createdBy;

                                    await detail.save();
                                    return res.json({
                                          status: 'success',
                                          message: 'Guardado'
                                    });
                              }
                              return res.json({
                                    status: 'errorMessage',
                                    message: 'Detalle no encontrado'
                              });
                              break;

                        case 'delete':
                              detail = await CatalogDetail.findByPk(req.body.detail);
                              if (detail) {

                                    await detail.destroy();
                                    return res.json({
                                          status: 'success',
                                          message: 'Eliminado'
                                    });
                              }
                              return res.json({
                                    status: 'errorMessage',
                                    message: 'detalle no encontrado'
                              });
                              break;
                        case 'hide':
                              detail = await CatalogDetail.findByPk(req.body.detail);
                              if (detail) {
                                    detail.revised = false;
                                    detail.updatedBy = createdBy;
                                    await detail.save();
                                    return res.json({
                                          status: 'success',
                                          message: 'Guardado'
                                    });
                              }
                              return res.json({
                                    status: 'errorMessage',
                                    message: 'Detalle no encontrado'
                              });
                              break;

                        case 'add_category':
                              //Buscar la categoria que exista

                              let category = await ProductClassification.findByPk(req.body.category);
                              if (category) {
                                    //buscar los productos de la categoria que no esten ya en el catalogo

                                    let products = await sequelize.query(`SELECT * FROM inventory_product WHERE stock > 0 and classification = ${category.id} and id not in (SELECT product FROM web_catalog_details where catalog = ${catalog.id})`, {
                                          type: QueryTypes.SELECT,
                                          model: Product
                                    });

                                    //recorrer los productos y agregarlos al catalogo
                                    let largo = products.length;
                                    if (largo > 0) {
                                          try {
                                                return await sequelize.transaction(async (t) => {
                                                      //devolver un respuesta
                                                      for (let index = 0; index < largo; index++) {
                                                            let prod = products[index];

                                                            detail = await CatalogDetail.create({
                                                                  product: prod.id,
                                                                  catalog: catalog.id,
                                                                  umbral: 0,
                                                                  price: prod.major,
                                                                  discount_price: prod.major,
                                                                  revised: false,
                                                                  createdBy,
                                                                  updatedBy: createdBy,
                                                            }, { transaction: t });

                                                      }

                                                      return res.json({
                                                            status: 'success',
                                                            message: `${largo} productos agregados al catálogo`
                                                      });
                                                });
                                          } catch (error) {
                                                return res.json({
                                                      status: 'error',
                                                      message: error.message,
                                                      error
                                                });
                                          }
                                    }
                                    return res.json({
                                          status: 'errorMessage',
                                          message: 'Ningun producto que agregar'
                                    });

                              } else {
                                    return res.json({
                                          status: 'errorMessage',
                                          message: 'Categoria no encontrada'
                                    });
                              }
                              break;

                        case 'quit_zero':
                              //Buscar la categoria que exista

                              let products = await CatalogDetail.findAll({
                                    where: {
                                          catalog: catalog.id
                                    }
                              });

                              let details = {};

                              products.forEach(el => details[el.product] = el);

                              products = await sequelize.query(`SELECT * FROM inventory_product WHERE id in (SELECT product FROM web_catalog_details where catalog = ${catalog.id})`, {
                                    type: QueryTypes.SELECT,
                                    model: Product
                              });

                              //recorrer los productos y agregarlos al catalogo
                              let largo = products.length;
                              if (largo > 0) {
                                    try {
                                          return await sequelize.transaction(async (t) => {

                                                let qty = 0;
                                                //devolver un respuesta
                                                for (let index = 0; index < largo; index++) {
                                                      let prod = products[index];

                                                      if (prod.stock == 0 && details[prod.id] !== undefined) {
                                                            await details[prod.id].destroy({ transaction: t });
                                                            qty++;
                                                      }
                                                }
                                                return res.json({
                                                      status: 'success',
                                                      message: `${qty} productos eliminados del catálogo`
                                                });
                                          });
                                    } catch (error) {
                                          return res.json({
                                                status: 'error',
                                                message: error.message,
                                                error
                                          });
                                    }
                              }
                              return res.json({
                                    status: 'errorMessage',
                                    message: 'No hay productos que quitar'
                              });


                              break;

                        case 'active':
                              //Buscar la categoria que exista
                              catalog.active = !catalog.active;
                              await catalog.save();
                              return res.json({
                                    status: 'success',
                                    message: `Actualizado`
                              });
                              break;

                        case 'selective':
                              //Buscar la categoria que exista
                              catalog.selective = !catalog.selective;
                              await catalog.save();
                              return res.json({
                                    status: 'success',
                                    message: `Actualizado`
                              });
                              break;
                        default:
                              return res.json({
                                    status: 'errorMessage',
                                    message: 'Opción no válida'
                              });
                              break;
                  }
            }

            return res.json({
                  status: 'errorMessage',
                  message: 'Catálogo no encontrado'
            });

      },

      accessList: async (req, res) => {
            let catalog = await Catalog.findByPk(req.params.id);
            if (catalog) {
                  let access_ = catalog.selective ? 1 : 0;
                  let clients = await sequelize.query(`select * from crm_client where id in(SELECT client FROM web_catalog_access WHERE catalog = ${catalog.id} and access = ${access_})`, {
                        type: QueryTypes.SELECT,
                        model: Client,
                        raw: true,
                  });
                  return res.render('Web/Catalog/accessList', {
                        pageTitle: catalog.selective ? 'Clientes con acceso a la Web' : 'Clientes con accedo Denegado',
                        catalog, clients
                  });
            }
            return Helper.notFound(req, res, "Catalog not Found")
      },

      clientOperations: async (req, res) => {
            let client = await Client.findByPk(req.body.client);
            if (client) {
                  let catalog = null;
                  switch (req.body.case) {
                        case 'grant_access':
                              client.has_web_access = !client.has_web_access;
                              await client.save();
                              return res.json({
                                    status: 'success',
                                    message: 'Guardado'
                              });
                              break;
                        case 'add_access':
                              //buscar el catalogo
                              catalog = await Catalog.findByPk(req.body.catalog);
                              if (catalog) {
                                    let relation = await CatalogAccess.findOne({
                                          where: {
                                                client: client.id,
                                                catalog: catalog.id
                                          }
                                    });
                                    if (catalog.selective) {
                                          //buscar la relacion
                                          if (relation) {
                                                if (relation.access == false) {
                                                      relation.access = true;
                                                      await relation.save();
                                                }
                                          } else {
                                                relation = await CatalogAccess.create({
                                                      client: client.id,
                                                      catalog: catalog.id,
                                                      access: true
                                                })
                                          }
                                          return res.json({
                                                status: 'success',
                                                message: 'Actualizado'
                                          });
                                    } else {
                                          if (relation) {
                                                await relation.destroy();
                                                return res.json({
                                                      status: 'success',
                                                      message: 'Actualizado'
                                                });
                                          }
                                    }
                                    return res.json({
                                          status: 'success',
                                          message: 'El catálogo es de acceso Libre'
                                    });
                              }
                              return Helper.notFound(req, res, 'Catalog not Found');
                              break;


                        case 'quit_access':
                              //buscar el catalogo
                              catalog = await Catalog.findByPk(req.body.catalog);
                              if (catalog) {
                                    let relation = await CatalogAccess.findOne({
                                          where: {
                                                client: client.id,
                                                catalog: catalog.id
                                          }
                                    });
                                    if (relation) {
                                          if (catalog.selective) {
                                                await relation.destroy();
                                          } else {
                                                relation.access = false;
                                                await relation.save();
                                          }

                                    } else {
                                          if (!catalog.selective) {
                                                relation = await CatalogAccess.create({
                                                      client: client.id,
                                                      catalog: catalog.id,
                                                      access: false
                                                });
                                          }
                                    }
                                    return res.json({
                                          status: 'success',
                                          message: 'Actualizado'
                                    });
                              }
                              return Helper.notFound(req, res, 'Catalog not Found');
                              break;
                        default:
                              return res.json({
                                    status: 'errorMessage',
                                    message: 'Opcion no valida'
                              });
                              break;
                  }
            }
            return Helper.notFound(req, res, 'Client not Found');
      },
};

module.exports = CatalogController;