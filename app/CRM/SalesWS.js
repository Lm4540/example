//modelos
const Client = require("./Models/Client");
const Sale = require('./Models/Sale');
const SaleDetail = require('./Models/SaleDetail');
const Product = require('../Inventory/Models/Product');
const Stock = require('../Inventory/Models/Stock');
const StockReserve = require('../Inventory/Models/StockReserve');
const Provider = require("../Inventory/Models/Provider");

//Controlladores
const SaleController = require('./Controllers/SaleController');


const sequelize = require("../DataBase/DataBase");
const { Op, QueryTypes } = require("sequelize");
const SalePayment = require("./Models/SalePayment");
// const Helper = require('../System/Helpers');
// const path = require('path');
// const fs = require('fs');
// const { Socket } = require("socket.io");

const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateString(length) {
    let result = ' ';
    const charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
}

module.exports = (io, socket) => {
    let group_identification = generateString(10);
    try {
        group_identification = 'user__' + socket.request.session.userSession.id;
        socket.join(group_identification);
    } catch (error) {
        
    }

    _io = io.of('/sales');

    socket.on('new_sale', async data => {
        var _process = data._process;
        //validar los datos
        let errorMessage = null;
        if (data.direction.length < 5) {
            errorMessage = 'Coloque una Dirección válida';
        } else if (data.phone.length < 8) {
            errorMessage = 'Coloque el teléfono de contacto';
        } else if (data.day.length < 10) {
            errorMessage = 'Seleccione una fecha válida';
        } else if (data.time.length < 5) {
            errorMessage = 'Seleccione una hora valida';
        } else if (data.dt.length < 1) {
            errorMessage = 'Agregue los productos al pedido';
        }

        if (errorMessage !== null) {
            _io.to(group_identification).emit("new_sale_error", { errorMessage, _process: _process });
        } else {

            let client = await Client.findByPk(data.client);
            if (client == null) {
                _io.to(group_identification).emit("new_sale_error", { errorMessage: 'Client not Found', _process: _process });
            }

            try {
                const result = await sequelize.transaction(async (t) => {

                    let sale = {
                        client: client.id,
                        seller: socket.request.session.userSession.employee.id,
                        sucursal: client.sucursal != null || client.sucursal != undefined ? client.sucursal : socket.request.session.userSession.employee.sucursal,
                        credit_conditions: 0,
                        _status: 'closed',
                        type: client.type,
                        balance: 0.00,
                        delivery_type: data.delivery_type,
                        delivery_direction: data.direction,
                        delivery_contact: data.phone,
                        delivery_instructions: data.reference,
                        delivery_date: data.day,
                        delivery_time: data.time,
                        delivery_amount: data.delivery_amount
                    };

                    if (data.delivery_type == 'delivery') {

                        sale.delivery_provider = data.delivery_provider;
                        //buscar el proveedor y actualizar sus direcciones sugeridas
                        let provider = await Provider.findByPk(data.delivery_provider);
                        if (provider) {
                            let destinos = provider.delivery_locations;
                            // console.log(destinos, provider);
                            if (!destinos.includes(data.direction)) {
                                destinos.push(data.direction);
                                provider.delivery_locations = destinos;
                                await provider.save({ transaction: t });
                            }
                        }
                    }

                    sale = await Sale.create(sale, { transaction: t });

                    let balance = 0.00,
                        ids = [],
                        products = {},
                        stocks = {},
                        _details = [];
                    //recorrer los detalles de y obtener los ID de los productos
                    data.dt.forEach(detail => ids.push(detail.product));

                    //buscar los productos
                    let tmp = await Product.findAll({
                        where: {
                            id: { [Op.in]: ids }
                        }
                    });

                    tmp.forEach(prod => products[prod.id] = prod);

                    //buscar los stock
                    tmp = await Stock.findAll({
                        where: {
                            product: { [Op.in]: ids },
                            sucursal: data.sucursal
                        }
                    });

                    tmp.forEach(prod => stocks[prod.product] = prod);

                    //recorrer los detalles

                    var len = data.dt.length;

                    for (let index = 0; index < len; index++) {
                        let dt = data.dt[index],
                            product = products[dt.product],
                            stock = stocks[dt.product];

                        if (product == undefined || stock == undefined) {
                            throw "Product or Stock not Found";
                        }

                        let max = stock.cant - stock.reserved;

                        if (dt.cant > max) {
                            dt.cant = max;
                        }

                        let detail = {
                            sale: sale.id,
                            product: dt.product,
                            price: dt.price,
                            description: product.name,
                            image: product.raw_image_name,
                            _order: index + 1,
                            cant: dt.cant,
                            ready: 0,
                            delivered: 0,
                            reserved: dt.cant
                        };

                        detail = await SaleDetail.create(detail, { transaction: t });
                        _details.push(detail);
                        balance += Number.parseFloat(dt.cant * dt.price);


                        //Actualizar el producto

                        product.reserved += dt.cant;
                        await product.save({ transaction: t });

                        stock.reserved += dt.cant;
                        await stock.save({ transaction: t });

                        //generar la reserva
                        let reserve = await StockReserve.create({
                            cant: dt.cant,
                            createdBy: socket.request.session.userSession.shortName,
                            concept: 'reserva por venta',
                            type: 'sale',
                            saleId: detail.id,
                            product: stock.product,
                            sucursal: stock.sucursal,
                        }, { transaction: t });
                    }

                    sale.balance = balance;
                    await sale.save({ transaction: t });

                    //emitir evento
                    _io.to(group_identification).emit("sale_saved", { sale: sale.id, _process: _process });

                    io.of('/logistics').emit('new_sale', {
                        sale, details: _details, client: client.name
                    });
                    //throw new Error();

                });
            } catch (error) {
                console.error(error);
                _io.to(group_identification).emit("new_sale_error", { errorMessage: error.message, _process: _process });
            }
        }
    });

    socket.on('close_sale', async data => {

        let errorMessage = null;
        if (data.direction.length < 5) {
            errorMessage = 'Coloque una Dirección válida';
        } else if (data.phone.length < 8) {
            errorMessage = 'Coloque el teléfono de contacto';
        } else if (data.day.length < 10) {
            errorMessage = 'Seleccione una fecha válida';
        } else if (data.time.length < 5) {
            errorMessage = 'Seleccione una hora valida';
        }

        if (errorMessage !== null) {
            _io.to(group_identification).emit("close_sale_error", { errorMessage, _process: data._process });
        } else {
            //Buscar el Cliente
            var cliente = await Client.findByPk(data.client);
            if (cliente == null) {
                _io.to(group_identification).emit("close_sale_error", { errorMessage: 'Client no found', _process: data._process });
            } else {
                var sale = await Sale.findOne({
                    where: {
                        [Op.and]: [
                            { _status: 'process' },
                            { client: cliente.id },
                        ],
                    },
                });
                //Buscar a venta abierta
                if (sale == null) {
                    _io.to(group_identification).emit("close_sale_error", { errorMessage: 'No Hay pedido abierto para este cliente', _process: data._process });
                } else {
                    //buscar que la venta tenga detalles en ella
                    let details = await SaleDetail.findAll({ where: { sale: sale.id } });

                    if (details.length > 0) {
                        //cerrar la venta y emitir el evento para el modulo de logistica
                        try {
                            const result = await sequelize.transaction(async (t) => {
                                sale._status = 'closed';
                                sale.delivery_type = data.delivery_type;
                                sale.delivery_direction = data.direction;
                                sale.delivery_contact = data.phone;
                                sale.delivery_instructions = data.reference;
                                sale.delivery_date = new Date(data.day);
                                sale.delivery_time = data.time;
                                sale.delivery_amount = data.delivery_amount;

                                if (data.delivery_type == 'delivery') {
                                    sale.delivery_provider = data.delivery_provider;
                                    //buscar el proveedor y actualizar sus direcciones sugeridas

                                    let provider = await Provider.findByPk(data.delivery_provider);
                                    if (provider) {
                                        let destinos = provider.delivery_locations;
                                        if (!destinos.includes(data.direction)) {
                                            destinos.push(data.direction);
                                            provider.delivery_locations = destinos;
                                            await provider.save({ transaction: t });
                                        }
                                    }
                                }


                                let payments = await SalePayment.findAll({
                                    where: {
                                        client: cliente.id,
                                        asigned_amount: sequelize.literal('asigned_amount < amount')
                                    }
                                });


                                if (payments.length > 0) {
                                    let sale_value = (sale.balance + sale.delivery_amount - sale.collected);
                                    for (let index = 0; index < payments.length; index++) {
                                        if (sale_value > 0) {
                                            let payment = payments[index];

                                            let max_payment_amount = (payment.amount - payment.asigned_amount);

                                            if (max_payment_amount > sale_value) {
                                                sale.collected += sale_value;
                                                if (sale.payments !== null) {
                                                    sale.payments.push({ "id": payment.id, "amount": sale_value })
                                                } else {
                                                    sale.payments = [{ "id": payment.id, "amount": sale_value }];
                                                }
                                                // sale._status = sale._status == 'delivered' ? 'collected' : sale._status;
                                                payment.asigned_amount != null ? payment.asigned_amount += sale_value : payment.asigned_amount = sale_value;
                                                if (payment.sales !== null) {
                                                    payment.sales.push({ "id": sale.id, "amount": sale_value });
                                                } else {
                                                    payment.sales = [{ "id": sale.id, "amount": sale_value }]
                                                }
                                                await payment.save({ transaction: t });
                                                sale_value = 0;
                                            } else {

                                                sale.collected += max_payment_amount;
                                                if (sale.payments !== null) {
                                                    sale.payments.push({ "id": payment.id, "amount": max_payment_amount })
                                                } else {
                                                    sale.payments = [{ "id": payment.id, "amount": max_payment_amount }];
                                                }
                                                // sale._status = sale._status == 'delivered' ? 'collected' : sale._status;
                                                payment.asigned_amount != null ? payment.asigned_amount += max_payment_amount : payment.asigned_amount = max_payment_amount;
                                                if (payment.sales !== null) {
                                                    payment.sales.push({ "id": sale.id, "amount": max_payment_amount });

                                                } else {
                                                    payment.sales = [{ "id": sale.id, "amount": max_payment_amount }];
                                                }

                                                await payment.save({ transaction: t });
                                                sale_value -= max_payment_amount;
                                            }
                                        } else {
                                            break;
                                        }
                                    }
                                }
                                await sale.save({ transaction: t });

                                //emitir evento
                                _io.to(group_identification).emit("sale_saved", { sale: sale.id, _process: data._process });

                                io.of('/logistics').emit('new_sale', {
                                    sale, details, client: cliente.name
                                });

                            });
                        } catch (error) {
                            console.error(error);
                            _io.to(group_identification).emit("close_sale_error", { errorMessage: error.message, _process: data._process });
                        }


                    } else {
                        _io.to(group_identification).emit("close_sale_error", { errorMessage: 'No Hay pedido abierto para este cliente', _process: data._process });
                        sale.destroy();
                    };
                }
            }
        }

    });

    socket.on('add_sale_detail', async data => {
        console.log(data);

        let res = await SaleController.socket_add_detail(data, socket.request.session.userSession);
        if (res.status == 'success') {
            let d = res.data;
            d._process = data._process;
            io.of('/logistics').emit('new_major_detail', d);
            _io.to(group_identification).emit("add_detail_success", d);
        } else {
            _io.to(group_identification).emit("add_detail_error", { errorMessage: res.message, _process: data._process });

        }

    });

    socket.on('quit_sale_detail', async data => {
        // console.log(data);
        let res = await SaleController.socket_delete_detail(data);
        if (res.status == 'success') {

            console.log(data);
            let d = res.data;
            res._process = data._process;
            res.deleted_detail = data.detail_id;
            io.of('/logistics').emit('deleted_major_detail', res);
            _io.to(group_identification).emit("quit_detail_success", res);
        } else {
            _io.to(group_identification).emit("quit_detail_error", { errorMessage: res.message, _process: data._process });

        }

    });


    socket.on('new_sale_in_sucursal', async data => {

        let res = await SaleController.socket_save_sale_in_room(data, socket.request.session.userSession);
        if (res.status == 'success') {
            console.log('emitiendo evento guardado con exito');
            _io.to(group_identification).emit("new_sale_in_sucursal_saved", {
                _process: data._process, sale: res.sale
            });
        } else {
            console.log('emitiendo evento error');
            _io.to(group_identification).emit("new_sale_in_sucursal_error", { errorMessage: res.message, _process: data._process });

        }

    });






    // socket.on("order:create", createOrder);
    // socket.on("order:read", readOrder);
}