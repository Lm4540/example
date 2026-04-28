const Sucursal = require('../../Inventory/Models/Sucursal');
const Client = require("../../CRM/Models/Client");
const Sale = require('../../CRM/Models/Sale');
const DTE = require('../../DTE/Models/DTE');

const Helper = require('../../System/Helpers');
const sequelize = require("../../DataBase/DataBase");
const { Op, QueryTypes } = require("sequelize");

const dte_types = {
      "01": "Factura",
      "03": "Comprobante de crédito fiscal",
      "04": "Nota de remisión",
      "05": "Nota de crédito",
      "06": "Nota de débito",
      "07": "Comprobante de retención",
      "08": "Comprobante de Liquidación",
      "09": "Documento contable de liquidación",
      "11": "Factura de exportación",
      "14": "Factura de sujeto excluido",
      "15": "Comprobante de donación"
};


function nombreMesYAnio(fecha) {
      const meses = [
            "enero", "febrero", "marzo", "abril", "mayo", "junio",
            "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
      ];

      const nombreMes = meses[fecha.getMonth()];
      const anio = fecha.getFullYear();

      return `${nombreMes} de ${anio}`;

}
function formatLocalSQL(date) {
      const pad = (n) => n.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}


function obtenerRangoMesCompleto(fechaReferencia) {
      const año = fechaReferencia.getFullYear();
      const mes = fechaReferencia.getMonth();
      const inicio = new Date(año, mes, 1, 0, 0, 0, 0);
      const fin = new Date(año, mes + 1, 0, 23, 59, 59, 999);
      return {
            inicio,
            fin,
            // Formato local (el que entiende MariaDB/MySQL y tu ERP)
            formatoSQL: {
                  inicio: formatLocalSQL(inicio),
                  fin: formatLocalSQL(fin)
            }
      };
}


const ReportController = {

      dashboard: async (req, res) => {
            return res.render('Accounting/Reports/index', { pageTitle: 'Repoortes Contables', });
      },

      salesBook: async (req, res) => {
            //devolver la vista del libro de compras            
            return res.render('Accounting/Reports/salesBook', { pageTitle: 'Libro de Ventas', limit: 10 });
      },


      salesBookData: async (req, res) => {
            let fechas = obtenerRangoMesCompleto(req.query.init ? new Date(req.query.init + '-10') : new Date());

            const init = fechas.inicio, end = fechas.fin;
            let sucursal = req.query.sucursal;


            let where = {
                  fecEmi: {
                        [Op.between]: [init, end],
                  },
            };

            if (sucursal) { where.sucursal = sucursal; }

            let registros = await DTE.findAll({
                  where,
            });

            let consumidor = {};
            let contribuyente = [];
            let contador = 0;


            registros.forEach(registro => {
                  if (registro.tipo == "01") {

                        if (consumidor[registro.fecEmi] !== undefined && consumidor[registro.fecEmi] !== null) {
                              consumidor[registro.fecEmi].cantidad++;
                              consumidor[registro.fecEmi].cod_final = registro.dte.identificacion.codigoGeneracion;
                              consumidor[registro.fecEmi].control_final = registro.dte.identificacion.numeroControl;
                              consumidor[registro.fecEmi].exentas = Helper.fix_number(consumidor[registro.fecEmi].exentas + parseFloat(registro.dte.resumen.totalExenta.toFixed(2)));
                              consumidor[registro.fecEmi].gravadas = Helper.fix_number(consumidor[registro.fecEmi].gravadas + parseFloat(registro.dte.resumen.totalGravada.toFixed(2)));
                              consumidor[registro.fecEmi].venta_total = Helper.fix_number(consumidor[registro.fecEmi].venta_total + parseFloat(registro.dte.resumen.montoTotalOperacion.toFixed(2)));
                        } else {
                              consumidor[registro.fecEmi] = {
                                    "fecha": registro.fecEmi,
                                    "cod_inicial": registro.dte.identificacion.codigoGeneracion,
                                    "cod_final": registro.dte.identificacion.codigoGeneracion,
                                    "control_inicial": registro.dte.identificacion.numeroControl,
                                    "control_final": registro.dte.identificacion.numeroControl,
                                    "exentas": parseFloat(registro.dte.resumen.totalExenta),
                                    "gravadas": parseFloat(registro.dte.resumen.totalGravada),
                                    "exportaciones": 0.00,
                                    "venta_total": parseFloat(registro.dte.resumen.montoTotalOperacion),
                                    cantidad: 1,
                              }
                        }
                  } else if (registro.tipo == "03") {
                        let iva = 0;

                        if (registro.dte.resumen.tributos[0].codigo == '20') {
                              iva = registro.dte.resumen.tributos[0].valor;

                        } else {
                              console.log('llega al else');
                              registro.dte.resumen.tributos.forEach(tributo => {
                                    if (tributo.codigo == '20') {
                                          iva = tributo.valor;
                                    }
                              });

                        }

                        contribuyente.push({
                              "num": contador++,
                              "fecha": registro.fecEmi,
                              "cod_generacion": registro.dte.identificacion.codigoGeneracion,
                              "control": registro.dte.identificacion.numeroControl,
                              "cliente": registro.dte.receptor.nombre.toUpperCase(),
                              "NRC": registro.dte.receptor.nrc,
                              "exportaciones": 0.00,
                              "gravadas": Helper.fix_number(registro.dte.resumen.totalGravada),
                              "debito_fiscal": Helper.fix_number(iva),
                              "exentas": registro.dte.resumen.totalExenta,
                              "terceros": '',
                              "debito_terceros": '',
                              "percibido": registro.dte.resumen.ivaPerci1,
                              "retenido": registro.dte.resumen.ivaRete1,
                              "venta_total": registro.dte.resumen.montoTotalOperacion
                        });
                  }
            });

            let keys = Object.keys(consumidor);
            let ordenadas = [];
            keys.forEach(k => ordenadas.push(consumidor[k]));
            const data = {
                  registros,
                  metadata: {
                        periodo: nombreMesYAnio(init),
                        rangoFechas: { inicio: init, fin: end }
                  },
                  consumidor: ordenadas,
                  contribuyente,
            }

            return res.json(data);
      },

      dte_report: async (req, res) => {
            let sucursals = await Sucursal.findAll();
            let _sucursals = {};
            sucursals.forEach(suc => {
                  _sucursals[suc.id] = suc.name;
            });
            return res.render('POS/report/report', {
                  sucursals: sucursals,
                  _sucursals,
                  dte_types
            });
      },

      dte_report_data: async (req, res) => {

            //buscar la informacion de los dte generados, filtrados como los quiera el usuario, preferentemente filtrados por tipo de dte

            //enviarlos formateadors para ser exportados directamente desde el objeto de json de la respuesta
      },

      dte_cost: async (req, res) => {
            let sucursals = await Sucursal.findAll();
            let _sucursals = {};
            sucursals.forEach(suc => {
                  _sucursals[suc.id] = suc.name;
            });
            return res.render('Accounting/Reports/cost', {
                  sucursals: sucursals,
                  _sucursals,
                  dte_types
            });
      },



      dte_cost_data: async (req, res) => {



            let data = req.body;
            let _whereSql = 'tipo = :tipo and trasnmitido = 1 ';
            let replacements = {
                  tipo: data.tipo
            };


            let where = {
                  tipo: data.tipo,
                  trasnmitido: 1
            };

            if (data.sucursal !== 'all') {
                  where.sucursal = data.sucursal;
                  _whereSql += ' and sucursal = :sucursal ';
                  replacements.sucursal = data.sucursal;
            }


            if (data.desde && data.hasta) {
                  where.fecEmi = {
                        [Op.between]: [data.desde, data.hasta]
                  };
                  _whereSql += ' and fecEmi between :desde and :hasta ';
                  replacements.desde = data.desde;
                  replacements.hasta = data.hasta;
            }

            let dtes = await DTE.findAll({
                  where: where,
                  order: [['fecEmi', 'ASC']]
            });

            //obtener las ventas
            let sales = {};
            let tmp = await sequelize.query(`
                  SELECT id, cost, _status, sucursal from crm_sale where id in (select sale from crm_dte where ${_whereSql})`, {
                  replacements: replacements,
                  type: QueryTypes.SELECT
            });
            tmp.forEach(sale => sales[sale.id] = sale);

            let categories = {};
            tmp = await sequelize.query('select _group, id, name from inventory_product_classification', {
                  type: QueryTypes.SELECT
            });
            tmp.forEach(category => categories[category.id] = category);
            if (data.report !== 'simple') {
                  tmp = await sequelize.query(`
                        SELECT crm_sale_detail.id, crm_sale_detail.sale, crm_sale_detail.product, crm_sale_detail.description, crm_sale_detail.cant, crm_sale_detail.product_cost as cost, inventory_product.classification as class, inventory_product_classification._group as g FROM crm_sale_detail inner join inventory_product on inventory_product.id = crm_sale_detail.product inner join inventory_product_classification on inventory_product_classification.id = inventory_product.classification WHERE crm_sale_detail.sale in (select sale from crm_dte where ${_whereSql})`, {
                        replacements: replacements,
                        type: QueryTypes.SELECT
                  });

                  tmp.forEach(detail => {
                        if (sales[detail.sale].details === undefined) {
                              sales[detail.sale].details = [];
                        }
                        sales[detail.sale].details.push(detail);
                  });
            }


            return res.json({
                  status: 'success',
                  dtes,
                  sales,
                  categories,
            });



      },

      registered_payments: async (req, res) => {
            //enviar la vista
      },

      registered_payments_data: async (req, res) => {

            //buscar los pagos registrados,

            //hacer un Join de las ventas relacionadas con los DTE emitidos.

            // Indexar la informacion y enviarla
      },
};

module.exports = ReportController;