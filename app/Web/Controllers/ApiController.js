const Helper = require('../../System/Helpers');
const Money = require('../../System/Money');
const { Op, QueryTypes } = require("sequelize");
const path = require('path');
const fs = require('fs');
const sequelize = require("../../DataBase/DataBase");
const sharp = require('sharp');

const Product = require('../../Inventory/Models/Product');
const Client = require("../../CRM/Models/Client");
const Catalog = require("../Models/Catalog");
const CatalogAccess = require("../Models/CatalogAccess");
const CatalogDetail = require("../Models/CatalogDetail");
const Employee = require('../../HRM/Models/Employee');
const ProductClassification = require('../../Inventory/Models/ProductClassification');

const client_has_access = async (client, catalog) => {
      if (client.has_web_access === false || catalog.active === false) {
            return false;
      }
      let access = await CatalogAccess.findOne({
            where: {
                  client: client.id,
                  catalog: catalog.id
            }
      });

      //Si el catálogo es selective, verificar si el cliente tiene acceso
      return (catalog.selective)
            ? (access != null && access.access == true)
            : (access == null || access.access == true);
}

const getNormalSize = ({ width, height, orientation }) => {
      return (orientation || 0) >= 5
            ? { width: height, height: width }
            : { width, height };
}


const base64_encode = (file) => {
      var bitmap = fs.readFileSync(file);
      return Buffer.from(bitmap).toString('base64');
}

const ApiController = {

      // funciones para que se conecten los clientes
      clientAutentication: async (req, res) => {

            console.log('recibiendo una solicitud en la clietn autorization')
            //buscar el cliente y verificar que exista
            let client = await Client.findByPk(req.body.pin);
            if (client) {
                  //verificar el segundoi dato del cliente
                  if (client.NIT_DUI != req.body.document || client.NIT_DUI == null) {
                 /* if ((client.classification == 'ninguno' && (client.NIT_DUI != req.body.document || client.NIT_DUI == null)) || (client.classification != 'ninguno' && (client.NRC != req.body.document || client.NRC == null))) {*/
                        return res.json({
                              status: 'error',
                              message: 'Datos del cliente incompletos, por favor pida a un asesor que actualize sus datos',
                              data: {client, nrc: (client.classification != 'ninguno' && (client.NRC != req.body.document || client.NRC == null)), dui: (client.classification == 'ninguno' && (client.NIT_DUI != req.body.document || client.NIT_DUI == null))

                              }
                        });
                  }

                  //verificar el tercero dato del cliente
                  if (client.has_web_access) {
                        //buscar los tags de accceso
                        let tmp = await CatalogAccess.findAll({
                              where: {
                                    client: client.id,
                              },
                              order: [['catalog', 'ASC']],
                        });

                        let access = [];
                        tmp.forEach(tag => access[tag.catalog] = tag.access);

                        //buscar los catalogos que tiene acceso
                        tmp = await Catalog.findAll({
                              where: {
                                    active: true,
                              },
                              order: [['name', 'ASC']],
                        });


                        let catalogs = [];
                        tmp.forEach(catalog => {
                              if (catalog.selective && access[catalog.id] !== undefined && access[catalog.id].access) {
                                    catalogs.push(catalog);
                              } else {
                                    if (access[catalog.id] === undefined) {
                                          if (access[catalog.id] !== false) {
                                                catalogs.push(catalog);
                                          }
                                    } else {
                                          catalogs.push(catalog);
                                    }
                              }
                        });

                        let seller = await Employee.findByPk(client.seller);

                        return res.json({
                              status: 'success',
                              data: {
                                    catalogs: catalogs,
                                    web_products: client.web_products,
                                    client: client.name,
                                    seller_name: seller.nickname,
                                    seller_number: seller.phone,
                              }
                        });
                  }

                  return res.json({
                        status: 'error',
                        message: 'Cliente sin acceso a los catalogos'
                  });
            }
            return res.json({
                  status: 'error',
                  message: 'Cliente no encontrado o no autorizado'
            })     //verificar que exista la clave

      },

      updateAccess: async (req, res) => {
            let client = await Client.findByPk(req.params.client);
            if (client) {
                  //verificar el tercero dato del cliente
                  if (client.has_web_access) {
                        //buscar los tags de accceso
                        let tmp = await CatalogAccess.findAll({
                              where: {
                                    client: client.id,
                              },
                              order: [['catalog', 'ASC']],
                        });

                        let access = [];
                        tmp.forEach(tag => access[tag.catalog] = tag.access);

                        //buscar los catalogos que tiene acceso
                        tmp = await Catalog.findAll({
                              where: {
                                    active: true,
                              },
                              order: [['name', 'ASC']],
                        });


                        let catalogs = [];
                        tmp.forEach(catalog => {
                              if (catalog.selective && access[catalog.id] !== undefined && access[catalog.id]) {
                                    catalogs.push(catalog);
                              } else {
                                    if (access[catalog.id] === undefined) {
                                          if (access[catalog.id] !== false) {
                                                catalogs.push(catalog);
                                          }
                                    } else {
                                          catalogs.push(catalog);
                                    }
                              }
                        });

                        let seller = await Employee.findByPk(client.seller);

                        return res.json({
                              status: 'success',
                              data: {
                                    catalogs: catalogs,
                                    web_products: client.web_products,
                                    client: client.name,
                                    seller_name: seller.nickname,
                                    seller_number: seller.phone,
                              }
                        });
                  }

                  return res.json({
                        status: 'error',
                        message: 'Cliente sin acceso a los catalogos'
                  });
            }

            return res.json({
                  status: 'error',
                  message: 'Cliente no encontrado o no autorizado'
            })     //verificar que exista la clave


      },

      getClientCatalogs: async (req, res) => {
            let tmp = await CatalogAccess.findAll({
                  where: {
                        client: req.params.client,
                  },
                  order: [['catalog', 'ASC']],
            });

            let access = [];
            tmp.forEach(tag => access[tag.catalog] = tag.access);

            //buscar los catalogos que tiene acceso
            tmp = await Catalog.findAll({
                  where: {
                        active: true,
                  },
                  order: [['name', 'ASC']],
            });


            let catalogs = [];
            tmp.forEach(catalog => {
                  if (catalog.selective && access[catalog.id] !== undefined && access[catalog.id]) {
                        catalogs.push(catalog);
                  } else {
                        if (access[catalog.id] !== undefined) {
                              if (access[catalog.id] !== false) {
                                    catalogs.push(catalog);
                              }
                        } else {
                              catalogs.push(catalog);
                        }
                  }
            });

            return res.json({
                  status: 'success',
                  data: catalogs
            });
      },

      getCatalog: async (req, res) => {
            let catalog = await Catalog.findByPk(req.params.id);
            let client = await Client.findByPk(req.params.client);
            if (catalog && client) {
                  let acc = await client_has_access(client, catalog);
                  if (!acc) {
                        return res.json({
                              status: 'error',
                              message: 'Acceso no autorizado'
                        })
                  }


                  let details = await CatalogDetail.findAll({
                        where: {
                              catalog: catalog.id,
                              revised: true
                        },
                        attributes: [
                              'product',
                              'umbral',
                              'price',
                              'discount_price'
                        ],
                        raw: true
                  });

                  let tmp = await sequelize.query(
                        "SELECT id, name, internal_code AS sku, image, stock - reserved as cant, base_price FROM `inventory_product` WHERE id in (SELECT product FROM web_catalog_details WHERE catalog = :catalog and revised = 1)",
                        {
                              replacements: { catalog: catalog.id },
                              type: QueryTypes.SELECT
                        }
                  );

                  let products = {};
                  tmp.forEach(el => products[el.id] = el);


                  let l = details.length;
                  for (let index = 0; index < l; index++) {
                        details[index].name = products[details[index].product].name;
                        details[index].cant = products[details[index].product].cant;
                        details[index].image = products[details[index].product].image;
                        details[index].sku = products[details[index].product].sku;
                        details[index].sugerido = products[details[index].product].base_price;
                  }

                  return res.json({
                        status: 'success',
                        data: { catalog, details }
                  });
            }
            return res.json({
                  status: 'error',
                  message: 'Catalogo no encontrado o no disponible'
            });

      },


      searchProductCatalog: async (req, res) => {

            let catalog = await Catalog.findByPk(req.params.id);
            let client = await Client.findByPk(req.params.client);
            if (catalog && client) {
                  if (!client_has_access(client, catalog)) {
                        return res.json({
                              status: 'error',
                              message: 'Acceso no autorizado'
                        })
                  }
                  let details = await CatalogDetail.findAll({
                        where: {
                              catalog: catalog.id,
                              revised: true
                        },
                        attributes: [
                              'product',
                              'umbral',
                              'price',
                              'discount_price'
                        ],
                        raw: true
                  });

                  let tmp = await sequelize.query(
                        "SELECT id, name, internal_code AS sku, image, stock - reserved as cant FROM `inventory_product`  WHERE (name like :search or internal_code like :search) and id in (SELECT product FROM web_catalog_details WHERE catalog = :catalog and revised = 1)",
                        {
                              replacements: { catalog: catalog.id, search: `%${req.params.keyword}%`, },
                              type: QueryTypes.SELECT
                        }
                  );

                  let products = {};
                  tmp.forEach(el => products[el.id] = el);


                  let l = details.length;
                  for (let index = 0; index < l; index++) {
                        details[index].name = products[details[index].product].name;
                        details[index].cant = products[details[index].product].cant;
                        details[index].image = products[details[index].product].image;
                  }

                  return res.json({
                        status: 'success',
                        data: { catalog, details }
                  });
            }
            return res.json({
                  status: 'error',
                  message: 'Catalogo no encontrado o no disponible'
            });
      },

      searchFullProduct: async (req, res) => {
            //buscar si el cliente tiene acceso a la busqueda de productos individuales
            let client = await Client.findByPk(req.params.client);
            if (client.has_web_access && client.web_products) {
                  let category = Number.parseInt(req.params.category);
                  let onlyStock = Number.parseInt(req.params.onlyStock);

                  let sql = "SELECT id, name, classification, internal_code AS sku, image, stock - reserved as cant, base_price as price, major_price as major FROM `inventory_product`  WHERE in_web = 1 ";

                  if (!isNaN(category) && category > 0) {
                        sql += ` and classification = ${category}`;
                  }

                  if (!isNaN(onlyStock) && onlyStock > 0) {
                        sql += ` and stock > reserved`;
                  }

                  let details = null;
                  if (req.query.keyword) {
                        sql += ` and (name like :search or internal_code like :search)`;
                        details = await sequelize.query(
                              sql + ' order by id DESC',
                              {
                                    replacements: { search: `%${req.query.keyword}%`, },
                                    type: QueryTypes.SELECT
                              }
                        );
                  } else {
                        details = await sequelize.query(
                              sql+ ' order by id DESC',
                              {
                                    type: QueryTypes.SELECT
                              }
                        );

                  }
                  return res.json({
                        status: 'success',
                        data: details
                  });
            }


            return res.json({
                  status: 'error',
                  message: 'Busqueda Libre no disponible para este cliente'
            });
            //si tiene acceso, hacer una busqueda full
      },

      getCategories: async (req, res) => {
            let categories = await ProductClassification.findAll({ where: { in_web: true }, attributes: ['id', 'name', 'image'], raw: true });

            return res.json({
                  status: 'success',
                  data: categories,
            });
      },

      all_products_for_no_logued: async (req, res) => {
            //buscar si el cliente tiene acceso a la busqueda de productos individuales

            let category = Number.parseInt(req.params.category);
            let sql = "SELECT id as product, name, internal_code AS sku, image, classification, base_price as price FROM `inventory_product`  WHERE in_web = 1  and stock > reserved";
            if (!isNaN(category) && category > 0) {
                  sql += ` and classification = ${category}`;
            }

            let details = null;


            if (req.query.keyword) {
                  sql += ` and (name like :search or internal_code like :search) order by id DESC`;
                  details = await sequelize.query(
                        sql + ' order by id DESC',
                        {
                              replacements: { search: `%${req.query.keyword}%`, },
                              type: QueryTypes.SELECT
                        }
                  );
            } else {
                  details = await sequelize.query(
                        `${sql} order by id DESC`,
                        {
                              type: QueryTypes.SELECT
                        }
                  );
            }
            return res.json({
                  status: 'success',
                  data: details
            });

            //si tiene acceso, hacer una busqueda full
      },

      getProductImage: async (req, res) => {
            let product = await Product.findByPk(req.params.id);
            if (product && product.raw_image_name !== null) {

                  //verificar si existe el archivo
                  let location = path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images', product.raw_image_name);

                  if (fs.existsSync(location)) {
                        fs.readFile(location, async (err, data) => {
                              if (err) {
                                    console.log(err);
                              } else if (data) {
                                    let image = await sharp(data);
                                    const size = getNormalSize(await sharp(data).metadata());
                                    if (size.width > 800 || size.height > 800) {
                                          image.resize(800, 800);
                                          await image.toFile(location);
                                    }
                              }
                        });
                        return res.json({
                              status: 'success',
                              image: base64_encode(location),
                        });
                  }
            }
            return res.json({
                  status: 'error',
                  message: 'No encontrado'
            });
      },

      getProductData: async (req, res) => {
            let product = await Product.findByPk(req.params.id);
            if (product) {

                  product = {
                        id: product.id,
                        name: product.name,
                        image: product.raw_image_name,
                        sku: product.sku,
                        major: product.major,
                        price: product.price,
                        classification: product.classification,
                        cant: (product.stock - product.reserved),
                        description: product.description
                  };

                  return res.json({
                        status: 'success',
                        data: product,
                  });
            }
            return res.json({
                  status: 'error',
                  message: 'No encontrado'
            });
      },

      getProductImage2: async (req, res) => {
            let location = path.join(__dirname, '..', '..', '..', 'public', 'upload', 'images', req.query.img);
            if (fs.existsSync(location)) {
                  try {
                        return await fs.readFile(location, async (err, data) => {

                              if (err) {
                                    console.log('Error a leer la imagen: ', err);
                                    return res.json({
                                          status: 'success',
                                          image: base64_encode(location),
                                    });
                              } else if (data) {
                                    let image = await sharp(data);
                                    const size = getNormalSize(await image.metadata());
                                    if (size.width > 800 || size.height > 800) {
                                          await image.resize(800, 800).toFile(location);
                                          return res.json({
                                                status: 'success',
                                                image: base64_encode(location),
                                          });
                                    } else {
                                          return res.json({
                                                status: 'success',
                                                image: base64_encode(location),
                                          });
                                    }
                              }
                        });
                  } catch (error) {
                        console.log('Error capturado en catch: ', error);
                        return res.json({
                              status: 'success',
                              image: base64_encode(location),
                        });
                  }
            }
            return res.json({
                  status: 'error',
                  message: 'No encontrado'
            });
      },
};

module.exports = ApiController;