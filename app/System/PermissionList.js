module.exports = [
    {
        "name": "Administrar usuarios",
        "explication": "Habilita todas las funciones para crear, actualizar, habilitar y bloquear usuarios",
        "group": "Sistema",
        "permission": "admin_users"
    },
    {
        "name": "Desbloquear usuarios",
        "explication": "Habilita la opcion de desbloquear usuarios bloqueados por intentos fallidos",
        "group": "Sistema",
        "permission": "unblock_users"
    },
    {
        "name": "Resetear Contraseñas",
        "explication": "Habilita la opcion de resetear la contraseña de colocando la contraseña por defecto.",
        "group": "Sistema",
        "permission": "reset_password"
    },
    {
        "name": "Establecer Permisos de usuario",
        "explication": "Permite establecer permisos temporales y permisos especiales a los usuarios existentes",
        "group": "Sistema",
        "permission": "set_user_permission"
    },
    {
        "name": "Establecer Permisos de Rol",
        "explication": "Permite establecer permisos temporales y permisos especiales a los Roles existentes",
        "group": "Sistema",
        "permission": "set_role_permission"
    },
    {
        "name": "Administrar variables del Sistema",
        "explication": "permite establecer variables del sistema, solo debe concedersde permiso a personas con conociento tecnico",
        "group": "Sistema",
        "permission": "admin_variables"
    },
    {
        "name": "Crear Producto",
        "explication": "Habilita las opciones de creacion de productos",
        "group": "Inventario",
        "permission": "create_product"
    },
    {
        "name": "Actualizar producto",
        "explication": "Habilita las opciones de actualizacion de productos",
        "group": "Inventario",
        "permission": "update_product"
    },
    {
        "name": "Registrar Proveedores",
        "explication": "Habilita las opciones de creacion de proveedores",
        "group": "Inventario",
        "permission": "create_provider"
    },
    {
        "name": "Actualizar Proveedores",
        "explication": "Habilita las opciones de Actualizacion de Proveedores",
        "group": "Inventario",
        "permission": "update_provider"
    },
    {
        "name": "Verificar Inventario Fisico",
        "explication": "Permite Colaborar en la verificacicon producto a producto durante el proceso de Inventario Fisico, pero no permite que se aperturen o se finalizen los procesos de inventario Fisico",
        "group": "Inventario",
        "permission": "check_physical_inventory"
    },
    {
        "name": "Finalizar Proceso de Inventario Fisico",
        "explication": "Permite Finalizar proceso de Inventario Fisico",
        "group": "Inventario",
        "permission": "finish_physical_inventory"
    },
    {
        "name": "Iniciar Proceso de Inventario Fisico",
        "explication": "Permite Iniciar proceso de Inventario Fisico",
        "group": "Inventario",
        "permission": "init_physical_inventory"
    },
    {
        "name": "Separar productos",
        "explication": "Permite Separar un producto en varios productos diferentes",
        "group": "Inventario",
        "permission": "unmerge_product"
    },
    {
        "name": "Unir productos",
        "explication": "Permite Unir varios productos en un unico producto",
        "group": "Inventario",
        "permission": "merge_product"
    },
    {
        "name": "Realizar Ajustes de Inventario",
        "explication": "Permite realizar ajustes de ingreso y egreso de unidades en inventario",
        "group": "Inventario",
        "permission": "adjust_inventory"
    },
    {
        "name": "Ingreso de Producto por compras",
        "explication": "Permite realizar el proceso de recepcion de productos por compras",
        "group": "Inventario",
        "permission": "in_purchased_products"
    },
    {
        "name": "Despacho de Productos por Ventas",
        "explication": "Permite dar por despachados los productos por ventas en el sistema",
        "group": "Inventario",
        "permission": "out_sold_products"
    },
    {
        "name": "Trasladar productos a otro Almacen",
        "explication": "Permite realizar traslado de productos desde el almacen al que pertenece el usuario",
        "group": "Inventario",
        "permission": "trasnfer_between_warehouses"
    },
    {
        "name": "Trasladar productos desde cualquier Almacen",
        "explication": "Permite Trasladar productos desde cualquier almacen",
        "group": "Inventario",
        "permission": "trasnfer_between_all_warehouses"
    },
    {
        "name": "Ingresar productos trasladados entre almacenes",
        "explication": "Permite Ingresar los productos trasladados al almacen de destino",
        "group": "Inventario",
        "permission": "receive_transfered_product"
    },
    {
        "name": "Ver la Lista de Reservas",
        "explication": "Permite Vizualizar la lista de Todos los productos reservados",
        "group": "Inventario",
        "permission": "view_reserve_list"
    },
    
    {
        "name": "Registro de Clientes",
        "explication": "habilita las opciones de registro de clientes",
        "group": "Ventas",
        "permission": "create_client"
    },
    {
        "name": "Regitro de Ventas",
        "explication": "Permite iniciar nuevos procesos de ventas",
        "group": "Ventas",
        "permission": "create_sale"
    },
    {
        "name": "Registro de Cobros a Clientes",
        "explication": "Registro de pagos realizados por los clientes",
        "group": "Ventas",
        "permission": "create_client_payment"
    },
    {
        "name": "Actualizacion de Ventas de otros usuarios",
        "explication": "Permite agregar detalles o realizar cambios en la venta registrada por otro usuario",
        "group": "Ventas",
        "permission": "update_sales_of_another_user"
    },
    {
        "name": "Consultar Informacion de Clientes",
        "explication": "permite acceder al historial de compras y pagos de los clientes",
        "group": "Ventas",
        "permission": "view_client_info"
    },
    {
        "name": "Ventas Rapidas (facturación en tienda)",
        "explication": "Permite realizar el proceso de Facturacion en tienda de ventas que no estan registradas",
        "group": "Ventas",
        "permission": "fast_sales"
    },
    {
        "name": "Finalizar Serie de documentos Comerciales",
        "explication": "Finalizar Serie de facturas",
        "group": "Ventas",
        "permission": "end_invoice_serie"
    },

    {
        "name": "Registrar Series de documentos Comerciales",
        "explication": "Finalizar Serie de facturas",
        "group": "Ventas",
        "permission": "create_invoice_serie"
    },

    
    {
        "name": "marcar Reservas realizadas",
        "explication": "Permite marcar como reservado el producto en las ventas agregadas",
        "group": "Logistica",
        "permission": "check_reservations"
    },
    {
        "name": "Identificar producto de ventas",
        "explication": "Permite identificar o cambiar el producto seleccionado por el vendedor cuando realiza el registro de la venta",
        "group": "Logistica",
        "permission": "identify_product"
    },
    {
        "name": "Impresión de Viñetas",
        "explication": "permite realizar el proceso de Impresión de Viñetas",
        "group": "Logistica",
        "permission": "print_labels"
    },
    {
        "name": "Reabrir ventas cerradas",
        "explication": "Permite reabrir ventas cerradas pero aun no entregadas para realizar modificaciones o agregar productos faltantes",
        "group": "Logistica",
        "permission": "reopen_sales"
    },
    {
        "name": "Registro de Compras",
        "explication": "Permite registrar compras",
        "group": "Compras",
        "permission": "create_purchase"
    },
    {
        "name": "Ver Costo de las compras",
        "explication": "Permite vizualizar el prorrateo de una compra",
        "group": "Compras",
        "permission": "view_product_cost"
    },

    
    {
        "name": "Registro de costos en compras",
        "explication": "Permite agregar los costos a las compras registradas",
        "group": "Compras",
        "permission": "create_purchase_cost"
    },
    {
        "name": "Ver Reportes de Ventas ",
        "explication": "permite vizualizar los reportes de compras reali<zadas",
        "group": "Finanzas",
        "permission": "view_sales_report"
    },
    {
        "name": "Administrar Cuentas por cobrar",
        "explication": "permite realizar la gestion de cuentas por cobrar",
        "group": "Finanzas",
        "permission": "admin_receibable_account"
    },
    {
        "name": "Administrar Cuentas por pagar",
        "explication": "Permite administrar las cuentas por pagar",
        "group": "Finanzas",
        "permission": "admin_payable_accounts"
    },
    {
        "name": "Administrar caja Chica de la Sucursal a la que pertenece",
        "explication": "Permite administrar la caja chica de la sucursal",
        "group": "Finanzas",
        "permission": "admin_petty_cash"
    },
    {
        "name": "Ver reportes de caja Chica",
        "explication": "Permite revisar los movimientos de caja chica",
        "group": "Finanzas",
        "permission": "view_petty_cash"
    }, 
    {
        "name": "Administrar Cualquier caja chica",
        "explication": "Permite administrar la caja chica de cualquier sucursal",
        "group": "Finanzas",
        "permission": "admin_all_petty_cash"
    }
]