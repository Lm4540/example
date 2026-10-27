// controllers/dteController.js
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const DTE = require('../Models/DTE');
const TokenManager = require('../TokenManager');
const { response } = require('express');
const variables = process.env;
const sequelize = require('../../DataBase/DataBase');
const signerService = require('./dteSigner.service');

// --- Constantes y Configuración ---
const SIGNER_URL = variables.SIGNER_URL;
const SIGNER_PASSWORD = variables.SIGNER_PASSWORD; // Contraseña de la llave privada del certificado
const MH_API_TIMEOUT = parseInt(variables.MH_API_TIMEOUT, 10) || 8000;
const MH_API_RETRY_DELAY = parseInt(variables.MH_API_RETRY_DELAY, 10) || 1000;
const MH_API_MAX_RETRIES = parseInt(variables.MH_API_MAX_RETRIES, 10) || 2;
const SIGNER_TIMEOUT = parseInt(variables.SIGNER_TIMEOUT, 10) || 5000;
const USER_NIT = variables.COMPANY_NIT; // NIT del usuario que firma el DTE

// --- URLs API MH ---
function getMhApiUrl(endpoint) {
    const baseUrls = variables.DTE_AMBIENTE === '01' ? {
        reception: variables.MH_RECEPTION_URL_PROD,
        consulta: variables.MH_CONSULTA_URL_PROD,
        anulacion: variables.MH_ANULACION_URL_PROD,
        contingencia: variables.MH_CONTINGENCIA_URL_PROD,
        loteReception: variables.MH_LOTE_RECEPTION_URL_PROD,
        loteConsulta: variables.MH_LOTE_CONSULTA_URL_PROD,
    } : {
        reception: variables.MH_RECEPTION_URL_TEST,
        consulta: variables.MH_CONSULTA_URL_TEST,
        anulacion: variables.MH_ANULACION_URL_TEST,
        contingencia: variables.MH_CONTINGENCIA_URL_TEST,
        loteReception: variables.MH_LOTE_RECEPTION_URL_TEST,
        loteConsulta: variables.MH_LOTE_CONSULTA_URL_TEST,
    };
    return baseUrls[endpoint];
}

/**
 * Genera un Código de Generación único (UUID v4).
 * @returns {string} UUID v4 en mayúsculas.
 */
function generarCodigoGeneracion() {
    generacion = uuidv4().toUpperCase();
    sequelize.query('INSERT INTO `crm_dte_generacion_asignados` (`id`, `code_`, `createdAt`) VALUES (NULL, :_code, :_date)', {
        replacements: {
            _code: generacion,
            _date: new Date()
        },
        type: sequelize.QueryTypes.INSERT
    });
    return generacion;
}

async function getNextCorrelativo(tipoDte, year, sucursal, puntoVenta) {
    let correlativo = await DTE.findOne({
        where: {
            tipo: tipoDte,
            createdAt: { [Op.gt]: `${year}-01-01`, },
            sucursal: sucursal,
            caja: puntoVenta
        },
        order: [['id', 'DESC']]
    });
    return correlativo ? correlativo.correlativo + 1 : 1; // Incrementar el correlativo
}

/**
 * @param {string} tipoDte - Ej: '01', '03'.
 * @param {string} codEstable - Código de establecimiento (ej: '0000').
 * @param {string} codPuntoVenta - Código de punto de venta (ej: '0000').
 * @returns {Promise<string>} El número de control generado.
 */
async function generarNumeroControl(tipoDte, sucursal, puntoVenta, codEstable, codPuntoVenta) {
    const year = new Date().getFullYear().toString();
    const correlativo = await getNextCorrelativo(tipoDte, year, sucursal, puntoVenta);
    var correlativoPadding = correlativo.toString().padStart(15, '0');
    if (codEstable == null || codEstable == "" || codPuntoVenta == null || codPuntoVenta == "") {
        codEstable = "0000";
        codPuntoVenta = "0000";
        correlativoPadding = String(sucursal) + correlativo.toString().padStart(14, '0');
    }

    return {
        correlativo,
        numControl: `DTE-${tipoDte}-${(codEstable.padStart(4, '0') + codPuntoVenta.padStart(4, '0'))}-${correlativoPadding}`
    };
}

/**
 * Consulta el estado de un DTE específico en la API del MH.
 * @param {string} tipoDte
 * @param {string} nitEmisor
 * @param {string} codigoGeneracion
 * @returns {Promise<object|null>} La respuesta de la consulta o null si no se encuentra o hay error.
 */
async function consultaEstadoDTE(tipoDte, codigoGeneracion, nitEmisor = USER_NIT) {

    console.log(tipoDte, codigoGeneracion, nitEmisor);
    const consultaUrl = getMhApiUrl('consulta');
    if (!consultaUrl) {
        return {
            status: 'errorToken',
            message: 'URL de consulta MH no configurada.',
        }
    }

    try {
        const token = await TokenManager.getToken();
        if (!token) {
            return {
                status: 'errorToken',
                message: `No se pudo autenticar con el MH. Token no disponible.`,
            }
        }
        const response = await axios.post(consultaUrl, {
            nitEmisor: nitEmisor,
            tdte: tipoDte,
            codigoGeneracion: codigoGeneracion
        }, {
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
                'User-Agent': 'dte-app-nodejs/1.0'
            },
            timeout: MH_API_TIMEOUT // Usar timeout estándar para consulta
        });
        return {
            status: 'success',
            message: `Respuesta`,
            data: response.data,
        }

        /* ejemplo de data exitosa
         data: {
            version: 2,
            ambiente: '01',
            versionApp: 2,
            estado: 'PROCESADO',
            codigoGeneracion: '243D28BF-E6B5-4129-8652-180757B122C2',
            selloRecibido: '20240AA6F9AA982D47529A3E7423FE8AAE2FL4I4',
            fhProcesamiento: '28/06/2024 08:43:18',
            clasificaMsg: '10',
            codigoMsg: '001',
            descripcionMsg: 'RECIBIDO',
            observaciones: []
        }
        */
    } catch (error) {
        if (error.response.status === 400 && error.response.data && error.response.data.codigoMsg === '999') {
            return {
                status: 'notFound',
                message: `Aun no se ha enviado un DTE con el código de generación ${codigoGeneracion}`,
                data: error.response.data,
            }
        }
        //si es otro error procesarlo como error
        return {
            status: 'errorFatal',
            message: `Error al consultar DTE ${codigoGeneracion}`,
            descripcionMsg: error.response?.data?.descripcionMsg || error.message,
            // data:  error.response ? error.response.data : error.message,
            data: error,
            // response: error.response,
        }
    }
}

async function signDTE(dteJson, complete = false) {
    let jws = await signerService.signDte(dteJson);
    return {
        status: 'success',
        message: 'Firmado exitosamente',
        data: complete ? jws : jws.data
    }
}

/**
 * 
 * Firma un documento DTE JSON usando el servicio local.
 * @param {object} dteJson - El objeto JSON del DTE a firmar.
 * @returns {Promise<string>} El DTE firmado en formato JWS (string).
 * @throws {Error} Si falla la firma.
 */
async function signDTEold(dteJson, complete = false) {
    if (!SIGNER_URL || !SIGNER_PASSWORD) {
        return {
            status: 'error',
            message: 'URL del firmador (SIGNER_URL) o contraseña (SIGNER_PASSWORD) no configuradas en .env',
        }
    }

    try {

        // console.log(SIGNER_PASSWORD, SIGNER_URL, USER_NIT);
        const response = await axios.post(SIGNER_URL, {
            nit: USER_NIT,
            activo: true, // Asumimos que el certificado está activo
            passwordPri: SIGNER_PASSWORD,
            dteJson: dteJson // Enviar el objeto JSON directamente
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: SIGNER_TIMEOUT
        });

        if (response.status === 200 && response.data && response.data.status === 'OK' && response.data.body) {
            return {
                status: 'success',
                message: 'Firmado exitosamente',
                data: complete ? response.data : response.data.body
            }
        } else {
            const errorMsg = response.data?.body?.mensaje || response.data?.error || 'Respuesta inesperada del firmador';
            console.error('Error en respuesta del firmador:', response.data);
            return {
                status: 'error',
                message: `Error del firmador: ${errorMsg}`,
            }
        }
    } catch (error) {

        const disp = await axios.get(SIGNER_URL + 'status');
        if (disp.status == 200 && disp.date == "Application is running...!!") {
            console.error('Error al conectar con el firmador:', error.response ? error.response.data : error.message);
            return {
                status: 'error',
                message: `No se pudo firmar el DTE: ${error.message}`,
            }
        }

        return {
            status: 'error',
            message: `El Servicio de Firma Electrónica no está disponible. Por favor, intente más tarde.`,
        }

    }
}

/**
 * Transmite un DTE firmado a la API del MH con política de reintentos.
 * @param {string} dteFirmado - El DTE firmado (JWS string).
 * @param {object} dteData - Los datos originales del DTE (para info de ambiente, tipo, etc.).
 * @returns {Promise<object>} La respuesta exitosa de la API del MH. o Json con error.
 
 */
async function transmitDTEWithRetry(dteData) {
    const receptionUrl = getMhApiUrl('reception');
    if (!receptionUrl) throw new Error("URL de recepción MH no configurada.");

    let dteFirmado = await signDTE(dteData, false);
    if (dteFirmado.status == undefined || dteFirmado.status !== 'success') {
        return {
            status: 'errorFirma',
            message: `Error al firmar el DTE: ${dteFirmado.message}`,
            data: dteFirmado.data || null
        }
    }


    var payload = {
        ambiente: dteData.identificacion.ambiente,
        idEnvio: new Date().getTime(), // ID único para este intento de envío
        version: dteData.identificacion.version,
        tipoDte: dteData.identificacion.tipoDte,
        documento: dteFirmado.data,
        codigoGeneracion: dteData.identificacion.codigoGeneracion
    };



    let retries = 0;
    let lastError = null;

    while (retries <= MH_API_MAX_RETRIES) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, MH_API_RETRY_DELAY));
        }

        try {
            var token = await TokenManager.getToken(); // Obtener token fresco en cada intento podría ser más seguro
            if (!token) {
                return {
                    status: 'errorToken',
                    message: `No se pudo autenticar con el MH. Token no disponible.`,
                }
            }


            const response = await axios.post(receptionUrl, payload, {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json',
                    'User-Agent': 'dte-app-nodejs/1.0'
                },
                timeout: MH_API_TIMEOUT // Timeout para la respuesta inicial
            });

            // Procesar respuesta exitosa
            if (response.status && response.status === 200 && response.data && (response.data.estado === 'PROCESADO' || response.data.estado === 'RECIBIDO')) {
                return {
                    status: 'success',
                    message: `DTE ${payload.codigoGeneracion} transmitido exitosamente. Estado: ${response.data.descripcionMsg}`,
                    data: response.data,
                    firma: dteFirmado.data,
                }
            }


            return {
                status: 'errorFatal',
                message: `Error no procesado, comuniquelo al desarrollador del Sistema`,
                data: response,
            };




        } catch (error) {
            lastError = error; // Guardar el último error
            console.error(`Error en intento ${retries + 1} para DTE ${payload.codigoGeneracion}:`, error.response ? error.response.data : error.message);

            // Manejar error 401 (Token inválido) -> Limpiar caché e intentar obtener uno nuevo en el siguiente ciclo
            if (error.response && error.response.status === 400) {

                if (error.response.data && (error.response.data.estado === 'RECHAZADO' || response.data.selloRecibido === null)) {
                    // Respuesta 200 pero con error lógico del MH (ej. RECHAZADO)
                    return {
                        status: 'errorRejected',
                        message: `DTE ${payload.codigoGeneracion} rechazado por el MH. Estado: ${error.response.data?.estado || 'Desconocido'}. Mensaje: ${error.response.data?.descripcionMsg || 'No disponible'}`,
                        data: error.response.data,
                    };
                }

                return {
                    status: 'errorFatal',
                    message: `Solicitud invalida al MH`,
                    data: error.response.data,
                }


            } else if (error.response && error.response.status === 401) {
                token = await TokenManager.getToken(true); // Forzar la renovacion del token
                if (!token) {
                    return {
                        status: 'errorToken',
                        message: `No se pudo autenticar con el MH. Token no disponible.`,
                        data: null
                    }
                }

            } else if (error.code === 'ECONNABORTED' || !error.response) {
                // Manejar timeout o error de red -> Consultar estado antes de reintentar
                console.log(`Timeout o error de red detectado para ${payload.codigoGeneracion}. Consultando estado...`);


                const estadoConsulta = await consultaEstadoDTE(dteData.emisor.nit, payload.tipoDte, payload.codigoGeneracion);
                if (estadoConsulta === null) {
                    return {
                        status: 'errorFatal',
                        message: `error al consultar el estado del DTE ${payload.codigoGeneracion}`,
                        data: null,
                    }
                } else {

                    if (estadoConsulta.status == "success") {
                        return {
                            status: 'success',
                            message: `DTE ${payload.codigoGeneracion} transmitido exitosamente. Estado: ${estadoConsulta.descripcionMsg}`,
                            data: estadoConsulta,
                            firma: dteFirmado.data,
                        }
                    } else if (estadoConsulta.status == "notFound") {
                        console.log("el DTE no fue encontrado continuando con la Transmisión");

                    } else {
                        //retornar el error como viene
                        return estadoConsulta;
                    }
                }

            } else if (error.response) {
                // Si es un error irrecuperable (ej. 400 Bad Request por datos mal formados), lanzar inmediatamente
                if (error.response.status > 401 && error.response.status < 500 && error.response.status !== 401) {
                    return {
                        status: 'error',
                        message: `Error ${error.response.status} irrecuperable del MH: ${error.response.data?.descripcionMsg || error.message}`,
                        data: error.response,
                    };
                }
            }


        } // Fin catch
        payload.idEnvio = new Date().getTime();
        retries++;
    } // Fin while

    // Si se agotan los reintentos, lanzar el último error conocido
    console.error(`Se agotaron los reintentos (${MH_API_MAX_RETRIES}) para DTE ${payload.codigoGeneracion}.`);
    // Considerar iniciar proceso de contingencia aquí si el último error fue de red/timeout
    if (lastError && (lastError.code === 'ECONNABORTED' || !lastError.response)) {

        console.warn(`El último error fue de conexión/timeout. Considerar activar contingencia para ${payload.codigoGeneracion}.`);
        return {
            status: 'errorContingencia',
            message: `No se pudo transmitir el DTE ${payload.codigoGeneracion} después de ${MH_API_MAX_RETRIES} reintentos. Se recomienda Activar contingencia por no disponibilidad del servicio de Hacienda.`,
            data: lastError,
        };
    }




    return {
        status: 'errorFatal',
        message: `No se pudo transmitir el DTE ${payload.codigoGeneracion} después de ${MH_API_MAX_RETRIES} reintentos. Por favor comuniquelo con el Desarrollador.`,
        data: lastError,
    };
}


async function transmitirInvalidacion(dteData) {

    const receptionUrl = getMhApiUrl('anulacion');
    if (!receptionUrl) throw new Error("URL de recepción MH no configurada.");

    let dteFirmado = await signDTE(dteData, false);
    if (dteFirmado.status !== 'success') {
        return {
            status: 'errorFirma',
            message: `Error al firmar el DTE: ${dteFirmado.message}`,
            data: dteFirmado.data || null
        }
    }

    var payload = {
        ambiente: variables.DTE_AMBIENTE,
        idEnvio: new Date().getTime(), // ID único para este intento de envío
        version: 2,
        documento: dteFirmado.data,
    };

    const codigoGeneracion = dteData.identificacion.codigoGeneracion;

    try {
        var token = await TokenManager.getToken(); // Obtener token fresco en cada intento podría ser más seguro
        if (!token) {
            return {
                status: 'errorToken',
                message: `No se pudo autenticar con el MH. Token no disponible.`,
            }
        }


        const response = await axios.post(receptionUrl, payload, {
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
                'User-Agent': 'dte-app-nodejs/1.0'
            },
            timeout: MH_API_TIMEOUT // Timeout para la respuesta inicial
        });

        // Procesar respuesta exitosa
        if (response.status === 200 && response.data && (response.data.estado === 'PROCESADO' || response.data.estado === 'RECIBIDO')) {
            return {
                status: 'success',
                message: `Evento ${codigoGeneracion} transmitido exitosamente. Estado: ${response.data.descripcionMsg}`,
                data: response.data,
                firma: dteFirmado.data,
            }
        }

        return {
            status: 'errorFatal',
            message: `Error no procesado, comuniquelo al desarrollador del Sistema`,
            data: response.data,
        };
    } catch (error) {
        // Manejar error 401 (Token inválido) -> Limpiar caché e intentar obtener uno nuevo en el siguiente ciclo
        if (error.response && error.response.status === 400) {

            if (error.response.data && (error.response.data.estado === 'RECHAZADO' || error.response?.data?.selloRecibido === undefined)) {
                // Respuesta 200 pero con error lógico del MH (ej. RECHAZADO)
                return {
                    status: 'errorRejected',
                    message: `DTE ${payload.codigoGeneracion} rechazado por el MH. Estado: ${error.response.data?.estado || 'Desconocido'}. Mensaje: ${error.response.data?.descripcionMsg || 'No disponible'}`,
                    data: error.response.data,
                };
            }

            return {
                status: 'errorFatal',
                message: `Solicitud invalida al MH`,
                data: error.response.data,
            }


        } else if (error.response && error.response.status === 401) {
            token = await TokenManager.getToken(true); // Forzar la renovacion del token
            if (!token) {
                return {
                    status: 'errorToken',
                    message: `No se pudo autenticar con el MH. Token no disponible.`,
                    data: null
                }
            }

        } else if (error.code === 'ECONNABORTED' || !error.response) {
            return {
                status: 'errorFatal',
                message: `La Conexion fue cerrada por hacienda, por favor consulte el DTE Manualmente`,
                data: null,
            }

        } else if (error.response) {
            // Si es un error irrecuperable (ej. 400 Bad Request por datos mal formados), lanzar inmediatamente
            if (error.response.status > 401 && error.response.status < 500 && error.response.status !== 401) {
                return {
                    status: 'error',
                    message: `Error ${error.response.status} irrecuperable del MH: ${error.response.data?.descripcionMsg || error.message}`,
                    data: error.response,
                };
            }
        }


    } // Fin catch

}

async function transmitirContingencia(dteData) {

    const receptionUrl = getMhApiUrl('contingencia');
    if (!receptionUrl) throw new Error("URL de recepción MH no configurada.");

    let dteFirmado = await signDTE(dteData, false);
    if (dteFirmado.status !== 'success') {
        return {
            status: 'errorFirma',
            message: `Error al firmar el DTE: ${dteFirmado.message}`,
            data: dteFirmado.data || null
        }
    }

    var payload = {
        nit: USER_NIT,
        documento: dteFirmado.data,
    };

    const codigoGeneracion = dteData.identificacion.codigoGeneracion;

    try {
        var token = await TokenManager.getToken(); // Obtener token fresco en cada intento podría ser más seguro
        if (!token) {
            return {
                status: 'errorToken',
                message: `No se pudo autenticar con el MH. Token no disponible.`,
            }
        }


        const response = await axios.post(receptionUrl, payload, {
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
                'User-Agent': 'dte-app-nodejs/1.0'
            },
            timeout: MH_API_TIMEOUT // Timeout para la respuesta inicial
        });

        // Procesar respuesta exitosa
        if (response.status === 200 && response.data && response.data.estado === 'RECIBIDO') {
            return {
                status: 'success',
                message: `Evento ${codigoGeneracion} transmitido exitosamente. Estado: ${response.data.descripcionMsg}`,
                data: response.data,
                firma: dteFirmado.data,
            }
        }

        return {
            status: 'errorFatal',
            message: `Error no procesado, comuniquelo al desarrollador del Sistema`,
            data: response.data,
        };
    } catch (error) {
        // Manejar error 401 (Token inválido) -> Limpiar caché e intentar obtener uno nuevo en el siguiente ciclo
        if (error.response && error.response.status === 400) {

            if (error.response.data && (error.response.data.estado === 'RECHAZADO' || error.response?.data?.selloRecibido === undefined)) {
                // Respuesta 200 pero con error lógico del MH (ej. RECHAZADO)
                return {
                    status: 'errorRejected',
                    message: `DTE ${payload.codigoGeneracion} rechazado por el MH. Estado: ${error.response.data?.estado || 'Desconocido'}. Mensaje: ${error.response.data?.descripcionMsg || 'No disponible'}`,
                    data: error.response.data,
                };
            }

            return {
                status: 'errorFatal',
                message: `Solicitud invalida al MH`,
                data: error.response.data,
            }


        } else if (error.response && error.response.status === 401) {
            token = await TokenManager.getToken(true); // Forzar la renovacion del token
            if (!token) {
                return {
                    status: 'errorToken',
                    message: `No se pudo autenticar con el MH. Token no disponible.`,
                    data: null
                }
            }

        } else if (error.code === 'ECONNABORTED' || !error.response) {
            return {
                status: 'errorFatal',
                message: `La Conexion fue cerrada por hacienda, por favor consulte el DTE Manualmente`,
                data: null,
            }

        } else if (error.response) {
            // Si es un error irrecuperable (ej. 400 Bad Request por datos mal formados), lanzar inmediatamente
            if (error.response.status > 401 && error.response.status < 500 && error.response.status !== 401) {
                return {
                    status: 'error',
                    message: `Error ${error.response.status} irrecuperable del MH: ${error.response.data?.descripcionMsg || error.message}`,
                    data: error.response,
                };
            }
        }


    } // Fin catch

}




// --- Exportar Funciones del Controlador ---
module.exports = {
    transmitDTEWithRetry,
    consultaEstadoDTE,
    generarCodigoGeneracion,
    generarNumeroControl,
    signDTE,
    transmitirInvalidacion,
    transmitirContingencia


    // Añadir aquí funciones para transmisión en lote, consulta de lote, etc.
};
