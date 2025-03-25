const SalesStatusController = require('../Controllers/DTEController');
const Auth = require("../../System/Middleware/SocketAuth");


module.exports = async (io, socket) => {
  if (socket.request.session !== undefined && socket.request.session.userSession !== undefined) {
    _io = io.of('/pos');
    //Emitir a la sucursal a la que pertenece el usuario
    let group_identification = 'pos__' + socket.request.session.userSession.sucursal;
    socket.join(group_identification);
  }
}