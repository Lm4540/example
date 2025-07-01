// controllers/dteController.js
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const DTE = require('../Models/DTE');
const Money = require('../../System/Money');
const TokenManager = require('../TokenManager');
const { validateDteData } = require('../dteValidator');
const { response } = require('express');
const variables = process.env;
const cache = require("memory-cache");

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
    const isProduction = variables.DTE_AMBIENTE === '01';
    const baseUrls = {
        reception: isProduction ? variables.MH_RECEPTION_URL_PROD : variables.MH_RECEPTION_URL_TEST,
        consulta: isProduction ? variables.MH_CONSULTA_URL_PROD : variables.MH_CONSULTA_URL_TEST,
        anulacion: isProduction ? variables.MH_ANULACION_URL_PROD : variables.MH_ANULACION_URL_TEST,
        contingencia: isProduction ? variables.MH_CONTINGENCIA_URL_PROD : variables.MH_CONTINGENCIA_URL_TEST,
        loteReception: isProduction ? variables.MH_LOTE_RECEPTION_URL_PROD : variables.MH_LOTE_RECEPTION_URL_TEST,
        loteConsulta: isProduction ? variables.MH_LOTE_CONSULTA_URL_PROD : variables.MH_LOTE_CONSULTA_URL_TEST,
    };
    return baseUrls[endpoint];
}

/**
 * Genera un Código de Generación único (UUID v4).
 * @returns {string} UUID v4 en mayúsculas.
 */
function generarCodigoGeneracion() {
    return uuidv4().toUpperCase();
}

// --- Función Placeholder para Correlativo ---
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

    // let correlativo = { correlativo: 5 }; // Simulación de correlativo, reemplazar con lógica real

    return correlativo ? correlativo.correlativo + 1 : 1; // Incrementar el correlativo
}

/**
 * Genera un Número de Control (requiere lógica específica).
 * Esta es una implementación de ejemplo simple, DEBES adaptarla.
 * @param {string} tipoDte - Ej: '01', '03'.
 * @param {string} codEstable - Código de establecimiento (ej: '0000').
 * @param {string} codPuntoVenta - Código de punto de venta (ej: '0000').
 * @returns {Promise<string>} El número de control generado.
 */
async function generarNumeroControl(tipoDte, sucursal, puntoVenta, codEstable, codPuntoVenta) {
    // console.log(tipoDte, sucursal, puntoVenta, codEstable, codPuntoVenta);
    // Lógica para obtener el siguiente correlativo (ej. desde BD o archivo)
    // ¡¡¡IMPLEMENTACIÓN DE EJEMPLO MUY BÁSICA!!!
    const year = new Date().getFullYear().toString();
    // Deberías tener un contador persistente por tipoDte, establecimiento, puntoVenta y año
    const correlativo = await getNextCorrelativo(tipoDte, year, sucursal, puntoVenta);
    var correlativoPadding = correlativo.toString().padStart(15, '0');
    // Formato: DTE-TT-EEEEPPPP-CCCCCCCCCCCCCCC (TT=Tipo, E=Estable, P=PVenta, C=Correlativo)
    // El formato del manual parece ser DTE-TT-EEEEPPPP-CCCCCCCCCCCCCCC

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
    // const consultaUrl = "https://api.dtes.mh.gob.sv/fesv/recepcion/consultadte/"
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

/**
 * 
 * Firma un documento DTE JSON usando el servicio local.
 * @param {object} dteJson - El objeto JSON del DTE a firmar.
 * @returns {Promise<string>} El DTE firmado en formato JWS (string).
 * @throws {Error} Si falla la firma.
 */
async function signDTE(dteJson, complete = false) {
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
    if (dteFirmado.status !== 'success') {
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
            if (response.status === 200 && response.data && (response.data.estado === 'PROCESADO' || response.data.estado === 'RECIBIDO')) {
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
                data: response.data,
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


async function handleInvalidationEvent(req, res) {
    const eventData = req.body;
    const dteTypeToInvalidate = eventData?.documento?.tipoDte;
    const nitEmisor = eventData?.emisor?.nit;

    console.log("Procesando evento de invalidación para DTE:", eventData?.documento?.codigoGeneracion);

    if (!nitEmisor || !dteTypeToInvalidate) {
        return res.status(400).json({ message: 'Faltan datos del emisor o del documento a invalidar.' });
    }

    // 1. Validar datos del evento contra anulacion-schema-v2.json
    const validationResult = validateDteData('anulacion', eventData);
    if (!validationResult.isValid) {
        console.error("Errores de validación Evento Anulación:", validationResult.errors);
        return res.status(400).json({
            message: 'Datos del evento de anulación inválidos.',
            errors: formatAjvErrors(validationResult.errors)
        });
    }
    console.log("Evento de anulación validado.");

    // 2. Aplicar reglas de invalidación (Ej: verificar si se necesita doc. reemplazo)
    const tipoAnulacion = eventData.motivo.tipoAnulacion;
    const requiereReemplazo = (tipoAnulacion === 1 || tipoAnulacion === 3) && !['05', '08'].includes(dteTypeToInvalidate); // Regla general, ajustar si es necesario

    if (requiereReemplazo && !eventData.documento.codigoGeneracionR) {
        return res.status(400).json({ message: `Para este tipo de anulación (${tipoAnulacion}) y DTE (${dteTypeToInvalidate}), se requiere el Código de Generación del documento que lo reemplaza.` });
    }
    if (!requiereReemplazo && eventData.documento.codigoGeneracionR) {
        // Asegurarse que sea null si no se requiere reemplazo o es NC/CL
        eventData.documento.codigoGeneracionR = null;
    }


    try {
        // 3. Generar código de generación para el evento si no existe
        if (!eventData.identificacion.codigoGeneracion) {
            eventData.identificacion.codigoGeneracion = generarCodigoGeneracion();
        }

        // 4. Firmar el evento de anulación
        console.log("Firmando evento de anulación...");
        const eventoFirmado = await signDTE(eventData, nitEmisor);

        // 5. Enviar evento al MH
        const anulacionUrl = getMhApiUrl('anulacion');
        if (!anulacionUrl) throw new Error("URL de anulación MH no configurada.");
        const token = await TokenManager.getToken();


        if (!token) {
            return {
                status: 'error',
                message: `No se pudo autenticar con el MH. Token no disponible.`,
            }
        }

        const payload = {
            ambiente: eventData.identificacion.ambiente,
            idEnvio: uuidv4().toUpperCase(),
            version: eventData.identificacion.version,
            documento: eventoFirmado // El evento firmado
        };

        console.log("Enviando evento de anulación a MH...");
        const mhResponse = await axios.post(anulacionUrl, payload, {
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
                'User-Agent': 'dte-app-nodejs/1.0'
            },
            timeout: MH_API_TIMEOUT
        });

        console.log("Respuesta MH Anulación:", mhResponse.data);

        // 6. Procesar respuesta MH
        if (mhResponse.data && (mhResponse.data.estado === 'PROCESADO' || mhResponse.data.estado === 'RECIBIDO')) {
            res.status(200).json({
                message: `Evento de anulación para ${eventData.documento.codigoGeneracion} procesado exitosamente.`,
                estadoMH: mhResponse.data.estado,
                selloRecibido: mhResponse.data.selloRecibido,
                codigoGeneracionEvento: eventData.identificacion.codigoGeneracion,
                mhResponse: mhResponse.data
            });
        } else {
            throw new Error(`MH rechazó el evento de anulación: ${mhResponse.data?.descripcionMsg || 'Error desconocido'}`);
        }

    } catch (error) {
        console.error(`Error procesando evento de anulación para ${eventData?.documento?.codigoGeneracion}:`, error.message);
        let statusCode = 500;
        if (error.response && error.response.status === 401) { clearCachedToken(); statusCode = 401; }
        if (error.message.includes('inválidos')) statusCode = 400;

        res.status(statusCode).json({
            message: `Error al procesar evento de anulación: ${error.message}`,
            errorDetails: error.mhResponse || error.toString()
        });
    }
}

/**
 * Maneja el envío de un evento de contingencia.
 */
async function handleContingencyEvent(req, res) {
    const eventData = req.body;
    const nitEmisor = eventData?.emisor?.nit;
    console.log("Procesando evento de contingencia...");

    if (!nitEmisor) {
        return res.status(400).json({ message: 'Falta NIT del emisor en los datos del evento.' });
    }

    // 1. Validar evento contra contingencia-schema-v3.json
    const validationResult = validateDteData('contingencia', eventData);
    if (!validationResult.isValid) {
        console.error("Errores de validación Evento Contingencia:", validationResult.errors);
        return res.status(400).json({
            message: 'Datos del evento de contingencia inválidos.',
            errors: formatAjvErrors(validationResult.errors)
        });
    }
    console.log("Evento de contingencia validado.");

    try {
        // 2. Generar código de generación para el evento si no existe
        if (!eventData.identificacion.codigoGeneracion) {
            eventData.identificacion.codigoGeneracion = generarCodigoGeneracion();
        }

        // 3. Firmar el evento
        console.log("Firmando evento de contingencia...");
        const eventoFirmado = await signDTE(eventData, nitEmisor);

        // 4. Enviar evento al MH
        const contingenciaUrl = getMhApiUrl('contingencia');
        if (!contingenciaUrl) throw new Error("URL de contingencia MH no configurada.");
        const token = await TokenManager.getToken();
        if (!token) {
            return {
                status: 'error',
                message: `No se pudo autenticar con el MH. Token no disponible.`,
            }
        }

        const payload = {
            nit: nitEmisor, // Endpoint contingencia pide NIT en payload
            documento: eventoFirmado
        };

        console.log("Enviando evento de contingencia a MH...");
        const mhResponse = await axios.post(contingenciaUrl, payload, {
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
                'User-Agent': 'dte-app-nodejs/1.0'
            },
            timeout: MH_API_TIMEOUT
        });

        console.log("Respuesta MH Contingencia:", mhResponse.data);

        // 5. Procesar respuesta MH
        if (mhResponse.data && mhResponse.data.estado === 'RECIBIDO') { // Estado específico para contingencia
            res.status(200).json({
                message: `Evento de contingencia procesado exitosamente.`,
                estadoMH: mhResponse.data.estado,
                selloRecibido: mhResponse.data.selloRecibido, // Sello del evento
                codigoGeneracionEvento: eventData.identificacion.codigoGeneracion,
                mhResponse: mhResponse.data
            });
        } else {
            throw new Error(`MH rechazó el evento de contingencia: ${mhResponse.data?.mensaje || 'Error desconocido'}`);
        }

    } catch (error) {
        console.error(`Error procesando evento de contingencia:`, error.message);
        // Manejar errores específicos (401, etc.)
        let statusCode = 500;
        if (error.response && error.response.status === 401) { clearCachedToken(); statusCode = 401; }
        if (error.message.includes('inválidos')) statusCode = 400;

        res.status(statusCode).json({
            message: `Error al procesar evento de contingencia: ${error.message}`,
            errorDetails: error.mhResponse || error.toString()
        });
    }
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
