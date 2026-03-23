const { Promotion, PromotionDetail } = require("../Models/Promotion");
const { QueryTypes } = require('sequelize');
const sequelize = require("../../DataBase/DataBase");

const PromotionController = {
      index: async (req, res) => {
            try {
                  const ahora = new Date();
                  const anio = ahora.getFullYear();
                  const mes = String(ahora.getMonth() + 1).padStart(2, '0'); 
                  const dia = String(ahora.getDate()).padStart(2, '0');
                  const fechaHoy = `${anio}-${mes}-${dia}`;
                  const fechaInicio = `${fechaHoy}T08:00`;
                  const fechaFin = `${fechaHoy}T17:00`;

                  const promotions = await sequelize.query(
                        `SELECT * FROM inventory_promotion ORDER BY createdAt DESC`,
                        { type: QueryTypes.SELECT }
                  );

                  res.render('CRM/Promotion/index', {
                        promotions, fechaInicio, fechaFin
                  });
            } catch (error) {
                  return res.status(500).json({ mensaje: error.message, error });

            }
      },

      // 2. Guardar Nueva Promoción con Transacción
      store: async (req, res) => {
            const t = await sequelize.transaction();
            try {
                  const { name, summary, promo_link, start_date, end_date, combo_price, alternatives_allowed, items } = req.body;

                  console.log(req.body)


                  let promo = await Promotion.create({
                        name,
                        summary,
                        promo_link,
                        start_date,
                        end_date,
                        combo_price,
                        createdBy: req.session.userSession.shortName,
                        alternatives_allowed,
                  }, {
                        transaction: t
                  });

                  if (items && items.length > 0) {
                        const values = items.map(item =>
                              `(${promo.id}, ${item.product_id}, '${item.sku}', '${item.provider_code}', ${item.quantity}, ${item.cost}, ${item.alternatives_allowed})`
                        ).join(',');

                        await sequelize.query(
                              `INSERT INTO inventory_promotion_detail (promotion_id, product_id, internal_code, provider_code, quantity, unit_cost_at_time, alternatives_allowed) VALUES ${values}`,
                              { transaction: t }
                        );
                  }

                  await t.commit();
                  res.json({ success: true });
            } catch (error) {
                  await t.rollback();
                  res.status(500).json({ error: error.message });
            }
      },

      // 3. Activar/Desactivar Promoción
      toggleStatus: async (req, res) => {

            try {
                  const { id } = req.params;
                  await sequelize.query(
                        `UPDATE inventory_promotion SET status = NOT status, updatedAt = NOW() WHERE id = ?`,
                        { replacements: [id], type: QueryTypes.UPDATE }
                  );
                  res.json({ success: true });
            } catch (error) {
                  res.status(500).json({ error: error.message });
            }
      },

      // 4. Eliminar solo si es mayor a un mes
      destroy: async (req, res) => {
            try {
                  const { id } = req.params;
                  const [results, metadata] = await sequelize.query(
                        `DELETE FROM inventory_promotion WHERE id = ? AND createdAt < DATE_SUB(NOW(), INTERVAL 1 MONTH)`,
                        { replacements: [id] }
                  );


                  if (metadata.affectedRows > 0) {
                        PromotionDetail.destroy({ where: { promotion_id: id } });
                        return res.json({ success: true, message: "Promoción eliminada correctamente." });
                  } else {
                        return res.status(400).json({
                              success: false,
                              message: "No se puede eliminar: la promoción no existe o tiene menos de un mes de antigüedad."
                        });
                  }
            } catch (error) {
                  res.status(500).json({ error: error.message });
            }
      },

      select2: async (req, res) => {
            let searchLimit = 15;
            let search = req.query.search;
            try {
                  let products = await sequelize.query(
                        "SELECT * FROM `inventory_product` WHERE (name like :search or internal_code like :search) and stock > reserved order by name ASC Limit 0,:limit ",
                        {
                              replacements: { search: `%${search}%`, limit: searchLimit, },
                              type: QueryTypes.SELECT
                        }
                  );

                  return res.json(products.map(el => {

                        let label = `${el.name}  #SKU( ${el.internal_code} )`;

                        let html_label = `<div class="row"><img src="${el.image !== null ? (el.image.includes('http') ? el.image : `/upload/images/${el.image}`) : '/upload/images/image-not-found.png'}" alt="product" style="max-width: 100px;" class="col-4"><span class="col-8">${label}</span></div>`;

                        return {
                              id: el.id,
                              value: el.id,
                              label: html_label,
                              sku: el.internal_code,
                              image: el.image !== null ? (el.image.includes('http') ? el.image : `/upload/images/${el.image}`) : '/upload/images/image-not-found.png',
                              code: el.base_price,
                              major: el.major_price,
                              stock: el.stock,
                              reserved: el.reserved,
                              name: el.name,
                              internal_code: el.internal_code,
                              provider_code: el.provider_code,
                              cost: el.cost,
                        }

                  }));


            } catch (error) {
                  console.log(error.message)
                  return res.status(500).json({ 'error': 'Internal Server Error' });
            }
      },

      verifyStock: async (req, res) => {
            try {
                  const { id } = req.params; // ID de la promoción
                  const { mode } = req.query; // 'local' o 'global'
                  // Obtenemos la sucursal desde la sesión del empleado
                  const sucursalId = req.session.userSession.employee.sucursal;
                  let query = "";
                  let replacements = [];
                  //buscar la promocion
                  let promo = await Promotion.findByPk(id);

                  if (promo) {
                        let details = await PromotionDetail.findAll({
                              where: {
                                    promotion_id: id
                              },
                              raw: true,
                        });
                        if (promo.status == false) {
                              return res.json({
                                    success: false,
                                    message: "Esta promocion esta Inactiva",
                                    details,
                                    promo
                              });
                        }

                        const largo = details.length;
                        if (largo > 0) {
                              let result = null
                              if (mode === 'local') {
                                    //Buscar los stock que tengan Existencias de los productos de la lista de detalles
                                    let tmp = await sequelize.query('select inventory_product.id, inventory_product.name, inventory_product.internal_code, inventory_product.image, (inventory_product_stock.cant - inventory_product_stock.reserved) as stock from inventory_product inner join inventory_product_stock  on inventory_product.id = inventory_product_stock.product where inventory_product_stock.sucursal = :sucursalId and inventory_product.id in (SELECT product_id FROM `inventory_promotion_detail` WHERE promotion_id = :id);', {
                                          replacements: { id, sucursalId },
                                          type: QueryTypes.SELECT,

                                    });

                                    let stock = {};
                                    tmp.forEach(element => {
                                          stock[element.id] = element;
                                    });

                                    console.log('elvalor de la variable de si no es: ', typeof promo.alternatives_allowed)

                                    if (promo.alternatives_allowed) {
                                          for (let index = 0; index < largo; index++) {
                                                if (details[index].alternatives_allowed) {
                                                      let alternativas = await sequelize.query(`select inventory_product.id, inventory_product.name, inventory_product.internal_code, inventory_product.image, (inventory_product_stock.cant - inventory_product_stock.reserved) as stock  from inventory_product inner join inventory_product_stock  on inventory_product.id = inventory_product_stock.product where inventory_product.internal_code != '${details[index].internal_code}' and inventory_product.provider_code = '${details[index].provider_code}' and inventory_product_stock.sucursal = ${sucursalId} and inventory_product_stock.cant > inventory_product_stock.reserved`, {
                                                            type: QueryTypes.SELECT
                                                      });
                                                      details[index].alternatives = alternativas.length < 1 ? null : alternativas;
                                                } else {
                                                      details[index].alternatives = null;
                                                }
                                                details[index].stock = stock[details[index]?.product_id] || null;
                                          }

                                    } else {
                                          for (let index = 0; index < largo; index++) {
                                                details[index].alternatives = null;
                                                details[index].stock = stock[details[index]?.product_id] || null;
                                          }
                                    }

                                    return res.json({
                                          success: true,
                                          message: "OK",
                                          details: details,
                                          promo: promo

                                    });

                              }

                              let tmp = await sequelize.query('select id, name, internal_code, image, (stock - reserved) as stock from inventory_product  where id in (SELECT product_id FROM `inventory_promotion_detail` WHERE promotion_id = :id);', {
                                    replacements: { id },
                                    type: QueryTypes.SELECT,

                              });

                              let stock = {};
                              tmp.forEach(element => {
                                    stock[element.id] = element;
                              });

                              if (promo.alternatives_allowed) {
                                    for (let index = 0; index < largo; index++) {
                                          if (details[index].alternatives_allowed) {

                                                let alternativas = await sequelize.query(`select id, name, internal_code, image, (stock - reserved) as stock  from inventory_product where internal_code != '${details[index].internal_code}' and provider_code = '${details[index].provider_code}' and stock > reserved`, {
                                                      type: QueryTypes.SELECT
                                                });
                                                details[index].alternatives = alternativas.length < 1 ? null : alternativas;

                                          } else {
                                                details[index].alternatives = null;
                                          }
                                          details[index].stock = stock[details[index].product_id];

                                    }
                              } else {
                                    for (let index = 0; index < largo; index++) {
                                          details[index].alternatives = null;
                                          details[index].stock = stock[details[index].product_id];

                                    }

                              }



                              return res.json({
                                    success: true,
                                    message: "OK",
                                    details: details,
                                    promo: promo

                              });


                        }

                        return res.json({
                              success: false,
                              message: "Esta promocion no fue detallada, no se puede Validar",
                        });
                  }
                  return res.json({
                        success: false,
                        message: "Promocion no encontrada",
                  });

            } catch (error) {
                  // Log de error para debug en consola y respuesta limpia al cliente
                  console.error("Error en verifyStock RG:", error);
                  return res.status(500).json({
                        success: false,
                        error: "Error al verificar existencias en la base de datos.",
                        details: error.message
                  });
            }
      },

      get_details: async (req, res) => {
            let id = req.params.id;
            let promo = await Promotion.findByPk(id);

            if (promo) {
                  let details = await PromotionDetail.findAll({
                        where: {
                              promotion_id: id
                        },
                        raw: true,
                  });
                  return res.json({
                        success: true,
                        message: "OK",
                        details: details,
                        promo: promo

                  });
            }

            return res.json({
                  success: false,
                  message: "Promocion no encontrada",
            });

      }
};

module.exports = PromotionController;