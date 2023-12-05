const { Server } = require("socket.io");
const LogisticsSocket = require("../Logistics/Sockets/Logistic");
const SalesSocket = require("../CRM/SalesWS");

module.exports = (server, session) => {
    const io = new Server(server);
    const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
    
    io.use(wrap(session));
    
    //Eventos del modulo de Logistica
    io.of('/logistics').use(wrap(session)).on('connection', function(socket) {
        LogisticsSocket(io, socket);
    });
    
    //Eventos del modulo de ventas
    io.of('/sales').use(wrap(session)).on('connection', function(socket) {
        // console.log(socket.request.session.userSession);
        SalesSocket(io, socket);
    });

    //Eventos del modulo de compras

    //Eventos del modulo de Inventario

    //Eventos generales de Socket Io
    io.on('connection', (socket) => {
        
        //importar rutas eventos


        //unir el socket al grupo de este socket

        //emitir un evento para ese socket con la info de las cuestiones necesarias


        //emitir evento de reaccion


        //emitir evento de nuevo porducto para la reserva


        //emitir evento de nuevo producto para mayoreo


        //emiir evento para nuevo producto para entrega


        //Emitir evento para producto revisado


        //emitir evento para producto entregado


        socket.on('getReservas', () => {

        });
    });
    
}