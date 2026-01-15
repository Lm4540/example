const SalesStatusController = require('../Controllers/SalesStatusController');
const StockController = require('../../Inventory/Controllers/StockController');
const Auth = require("../../System/Middleware/SocketAuth");


module.exports = async (io, socket) => {
  if (socket.request.session !== undefined && socket.request.session.userSession !== undefined) {


    _io = io.of('/logistics');
    let group_identification = 'user__' + socket.request.session.userSession.id;
    socket.join(group_identification);

    _io.to(group_identification).emit("logistics data", await SalesStatusController.get_data(socket.request.session.userSession));

    socket.on('package_delivered', async sale => {
      if (await Auth.Auth(socket.request.session)) {

        let res = await SalesStatusController.pakage_delivered(sale, socket.request.session.userSession);
        if (res.status == 'success') {
          io.of('/logistics').emit('pakage_delivered_success', res.data);
        } else {
          console.log('error al procesar el paquete', res);
        }

      } else {
        socket.disconnect();
      }

    });

    socket.on('package_trasnport', async sale => {
      if (await Auth.Auth(socket.request.session)) {
        let res = await SalesStatusController.package_trasnport(sale, socket.request.session.userSession);
        if (res.status == 'success') {
          io.of('/logistics').emit('package_trasnport_success', res.data);
        } else {
          console.log('error al procesar el paquete', res);
        }

      } else {
        socket.disconnect();
      }

    });

    socket.on('mayor_detail_revised', async (data) => {
      if (await Auth.Auth(socket.request.session)) {

        let res = await SalesStatusController.mayor_detail_revised(data, socket.request.session.userSession);
        if (res.status == 'success') {
          io.of('/logistics').emit('mayor_detail_revised_success', res.data);
        } else {
          _io.to(group_identification).emit("mayor_detail_revised_error", { errorMessage: res.message, _process: data._process });
        }
      } else {
        socket.disconnect();
      }
    });

    socket.on('package_ready', async data => {
      if (await Auth.Auth(socket.request.session)) {
        let res = await SalesStatusController.package_ready(data.sale_id, socket.request.session.userSession);
        if (res.status == 'success') {
          io.of('/logistics').emit('package_ready_success', res.sale);
        } else {
          _io.to(group_identification).emit("package_ready_error", { errorMessage: res.message, _process: data._process });
        }

      } else {
        socket.disconnect();
      }

    });

    socket.on('nd_package_revoke', async data => {
      if (await Auth.Auth(socket.request.session)) {
        let res = await SalesStatusController.package_not_delivered(data, socket.request.session.userSession);
        if (res.status == 'success') {
          io.of('/logistics').emit('nd_package_revoke_success', res.data);
        } else {
          _io.to(group_identification).emit("nd_package_revoke_error", { errorMessage: res.message });
        }

      } else {
        socket.disconnect();
      }

    });

    socket.on('nd_package_resend', async data => {
      if (await Auth.Auth(socket.request.session)) {
        let res = await SalesStatusController.package_resend(data, socket.request.session.userSession);
        if (res.status == 'success') {
          io.of('/logistics').emit('nd_package_resend_success', res.data);
        } else {
          _io.to(group_identification).emit("nd_package_resend_error", { errorMessage: res.message });
        }

      } else {
        socket.disconnect();
      }
    });

    socket.on('save_new_transfer', async data => {
      if (await Auth.Auth(socket.request.session)) {
        let permissions = socket.request.session.userSession.permission;
        if (permissions.includes('trasnfer_between_warehouses') || permissions.includes('trasnfer_between_all_warehouses')) {
          let res = await StockController.saveTransferShipment(data, socket.request.session.userSession);
          if (res.status == 'success') {
            _io.to(group_identification).emit("save_new_transfer_success", { shipment: res.shipment, _process: data._process });
          } else {
            _io.to(group_identification).emit("save_new_transfer_error", { errorMessage: res.message, _process: data._process });
          }

        } else {
          _io.to(group_identification).emit("save_new_transfer_error", { errorMessage: 'No tienes permiso para realizar esta operación', _process: data._process });
        }

      } else {
        socket.disconnect();
      }
    });

    // socket.on("order:create", createOrder);
    // socket.on("order:read", readOrder);


  }else {
    socket.disconnect();
  }

}