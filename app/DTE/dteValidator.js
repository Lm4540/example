// dteValidator.js (Nuevo Controlador para Validación de JSON DTE/Eventos)

const Ajv = require("ajv");
const addFormats = require("ajv-formats"); // To handle formats like date, email, etc.

// DTEs (identificados por tipoDte)
// Factura Electrónica (01), 
// Comprobante Crédito Fiscal (03),
// Nota de Remisión (04),
// Nota de Crédito (05), 
// Nota de Débito (06), 
// Comprobante Retención (07), 
// Comprobante Liquidación (08), 
// Documento Contable Liquidación (09), 
// Factura Exportación (11), 
// Factura Sujeto Excluido (14),
// Comprobante Donación (15)
const schemas = {
      "01": require('./schemas/v2/fe-f-v2.json'),
      "03": require('./schemas/v4/fe-ccf-v4.json'),
      "04": require('./schemas/v4/fe-nr-v4.json'),
      "05": require('./schemas/v4/fe-nc-v4.json'),
      "06": require('./schemas/v4/fe-nd-v4.json'),
      "07": require('./schemas/v2/fe-cr-v2.json'),
      "08": require('./schemas/v2/fe-cl-v2.json'),
      "09": require('./schemas/v2/fe-dcl-v2.json'),
      "11": require('./schemas/v3/fe-fex-v3.json'),
      "14": require('./schemas/v2/fe-fse-v2.json'),
      "15": require('./schemas/v2/fe-cd-v2.json'),
      // Eventos (identificados por un nombre clave)
      "anulacion": require('./schemas/v3/invalidacion-schema-v3.json'),
      "especial": require('./schemas/v1/fe-eop-v1.json'),
      "retorno": require('./schemas/v1/fe-eret-v1.json'),
      "contingencia": require('./schemas/v4/contingencia-schema-v4.json'),
};

// --- Configurar AJV y Compilar Schemas ---
const ajv = new Ajv({ allErrors: true, strict: false }); // allErrors: true para obtener todos los errores, no solo el primero
addFormats(ajv); // Añadir soporte para formatos estándar (date, email, etc.)

const validators = {};
console.log(`Compilando Schemas...`);
for (const key in schemas) {
      try {
            validators[key] = ajv.compile(schemas[key]);
      } catch (err) {
            console.error(`Error compilando schema ${key}:`, err);
      }
}

/**
 * Valida un objeto JSON contra un schema específico precompilado.
 * @param {string} schemaKey - La clave del schema a usar (ej: "01", "03", "anulacion").
 * @param {object} jsonData - El objeto JSON a validar.
 * @returns {{isValid: boolean, errors: object[] | null}} - Objeto indicando validez y errores.
 */
function validateWithSchema(schemaKey, jsonData) {
      const validate = validators[schemaKey];
      if (!validate) {
            console.error(`Schema con clave "${schemaKey}" no encontrado o no compilado.`);
            return { isValid: false, errors: [{ message: `Schema no encontrado: ${schemaKey}` }] };
      }

      const isValid = validate(jsonData);
      if (!isValid) {
            //Manejar los errores y saltarse los errores que tienen que ver con MultipleOF
            let _errors = validate.errors.filter(error => {
                  return !(error.keyword === 'multipleOf');
            });

            return _errors.length > 0 ? {
                  isValid: false,
                  errors: _errors
            } : {
                  isValid: true,
                  errors: null
            }

      }

      return {
            isValid: true,
            errors: null
      };
}

// --- Funciones de Validación Específicas (Opcional, pero solicitado) ---
// Estas funciones simplemente llaman a validateWithSchema con la clave correcta.

function validateFC(jsonData) { // Factura Electrónica (01)
      return validateWithSchema("01", jsonData);
}

function validateCCF(jsonData) { // Comprobante Crédito Fiscal (03)
      return validateWithSchema("03", jsonData);
}

function validateNR(jsonData) { // Nota de Remisión (04)
      return validateWithSchema("04", jsonData);
}

function validateNC(jsonData) { // Nota de Crédito (05)
      return validateWithSchema("05", jsonData);
}

function validateND(jsonData) { // Nota de Débito (06)
      return validateWithSchema("06", jsonData);
}

function validateCR(jsonData) { // Comprobante Retención (07)
      return validateWithSchema("07", jsonData);
}

function validateCL(jsonData) { // Comprobante Liquidación (08)
      return validateWithSchema("08", jsonData);
}

function validateDCL(jsonData) { // Documento Contable Liquidación (09)
      return validateWithSchema("09", jsonData);
}

function validateFEX(jsonData) { // Factura Exportación (11)
      return validateWithSchema("11", jsonData);
}

function validateFSE(jsonData) { // Factura Sujeto Excluido (14)
      return validateWithSchema("14", jsonData);
}

function validateCD(jsonData) { // Comprobante Donación (15)
      return validateWithSchema("15", jsonData);
}

function validateAnulacion(jsonData) { // Evento Anulación
      return validateWithSchema("anulacion", jsonData);
}

function validateContingencia(jsonData) { // Evento Contingencia
      return validateWithSchema("contingencia", jsonData);
}


// --- Función Principal de Validación ---

/**
 * Valida un documento (DTE o Evento) JSON determinando el schema a usar.
 * Intenta usar `jsonData.identificacion.tipoDte` para DTEs.
 * Para eventos u otros tipos, se debe pasar `schemaType` explícitamente.
 * @param {object} jsonData - El objeto JSON a validar.
 * @param {string} [schemaType] - Tipo de schema explícito (ej: "anulacion", "contingencia", o un tipoDte "01", "03", etc.).
 * Se usa si no se puede determinar automáticamente o para forzar un tipo.
 * @returns {{isValid: boolean, errors: object[] | null, schemaUsed: string | null}} - Objeto con resultado y schema usado.
 */
function validateDocument(jsonData, schemaType = null) {
      let keyToUse = schemaType; // Usar el tipo explícito si se proporciona

      // Si no se proporciona tipo explícito, intentar determinarlo desde el JSON (para DTEs)
      if (!keyToUse) {
            if (jsonData && jsonData.identificacion && jsonData.identificacion.tipoDte) {
                  keyToUse = jsonData.identificacion.tipoDte;
            } else {
                  // No se puede determinar automáticamente (podría ser un evento o JSON inválido)
                  return {
                        isValid: false,
                        errors: [{ message: "No se pudo determinar el tipo de documento (tipoDte) o no se proporcionó schemaType." }],
                        schemaUsed: null
                  };
            }
      }

      // Validar usando la clave determinada o proporcionada
      const result = validateWithSchema(keyToUse, jsonData);

      return {
            ...result, // isValid, errors
            schemaUsed: keyToUse // Informar qué schema se intentó usar
      };
}

module.exports = {
      validateDocument,
      validateWithSchema,
      // Exportar funciones específicas si se desean usar directamente
      validateFC,
      validateCCF,
      validateNR,
      validateNC,
      validateND,
      validateCR,
      validateCL,
      validateDCL,
      validateFEX,
      validateFSE,
      validateCD,
      validateAnulacion,
      validateContingencia,
      // Exportar la instancia de Ajv o validadores compilados si es necesario externamente
      // ajvInstance: ajv,
      // compiledValidators: validators
};