const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../../DataBase/DataBase");

const Purchase = sequelize.define('Purchase', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
    },
    provider: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
    },
    iva: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
    },
    renta: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
    },
    iva_percibido: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
    },
    iva_retenido: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
    },
    other_taxes: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
    },
    invoice_type: {
        type: DataTypes.ENUM,
        values: ['invoice', 'fc', 'ccf', 'fcf']
    },
    invoice_number: DataTypes.STRING,
    invoice_date: DataTypes.DATE,
    credit_conditions: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
    },
    _nit: DataTypes.STRING(50),
    _ncr: DataTypes.STRING(50),
    fc_data: DataTypes.TEXT,
    isIn: DataTypes.BOOLEAN,
    inComments: DataTypes.STRING(500),
    purchase_type: {
        type: DataTypes.ENUM,
        values: ['product', 'services', 'purchase_expense', 'sale_expense', 'equipment_purchase']
    },
    _image: DataTypes.STRING,
    createdBy: DataTypes.STRING(50),
    dte_codigoGeneracion: DataTypes.STRING,
    dte_numeroControl: DataTypes.STRING,
    dte: {
        type: DataTypes.TEXT,
        get() {
            let locations = this.getDataValue('dte');
            return locations !== null && locations !== '[]' ? JSON.parse(locations) : [];
        },
        set(param) {
            this.setDataValue('dte', param == null ? null : JSON.stringify(param));
        }
    },
    amount: {
        type: DataTypes.VIRTUAL,
        get() {
            return this.subtotal + this.iva + this.iva_percibido - this.iva_retenido - this.renta + this.other_taxes
        },
    }
}, {
    tableName: 'purchase',
});

module.exports = Purchase;


/**
 * 
 * 
 * <select id="type_tr_0" class="transparent_input detail_type" data-id="0" data-case="type">
                              <option class="select-items" value="product" selected="">Producto para Inventario</option>
                              <option class="select-items" value="factured_expense">Gastos Facturados</option>
                              <option class="select-items" value="services">Gastos Administrativos (Servicios, Papeleria, etc)</option>
                              <option class="select-items" value="purchase_expense">Gastos S/Compras</option>
                              <option class="select-items" value="sale_expense">Gastos S/Ventas</option>
                              <option class="select-items" value="equipment_purchase">Compra de equipo/Mobiliario</option>
                          </select>


                          <select id="purchase_type" class="form-control">
                           <option class="pt_option_local" value="local" selected="">Compra Nacional</option>
                           <option class="pt_option_local" value="services">Gastos Administrativos(Servicios, Papeleria, etc)</option>
                           <option value="purchase_expense">Gastos S/Compras</option>
                           <option class="pt_option_local" value="sale_expense">Gastos S/Ventas</option>
                           <option value="equipment_purchase">Compra de equipo/Mobiliario</option>
                           <option class="pt_option_international" value="internacional">Importacion/Compra Internacional</option>
                        </select>
 */