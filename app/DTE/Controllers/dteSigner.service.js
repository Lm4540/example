
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const cache = require('memory-cache');

// Claves de almacenamiento para el módulo memory-cache
const CACHE_KEY_RAW_CERT = 'SV_FE_CERT_RAW_CONTENT';
const CACHE_KEY_PARSED_DATA = 'SV_FE_CERT_PARSED_DATA';

const CERT_PASSWORD = process.env.SIGNER_PASSWORD || process.env.CERT_PASSWORD || 'TuClavePrivada';
const CERT_FILENAME = '05110312001029.crt';

class DteSignerService {


  /**
   * Codifica un Buffer o cadena de texto en formato Base64URL según RFC 7515 / RFC 4648.
   * Transforma Base64 estándar reemplazando '+' por '-', '/' por '_' y eliminando el padding '='.
   * 
   * @param {Buffer|string} input - Datos de entrada para codificar.
   * @returns {string} Cadena en formato Base64URL.
   */
  static base64UrlEncode(input) {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
    return buffer.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Localiza y retorna la ruta absoluta del archivo de certificado en el mismo directorio del servicio.
   * Busca primero por CERT_FILENAME; si no existe, busca cualquier archivo con extensión .crt o .xml.
   * 
   * @returns {string} Ruta absoluta del archivo de certificado.
   * @throws {Error} Si no se encuentra ningún certificado en el directorio.
   */
  static resolveCertFilePath() {

    // 1. Verificar nombre de archivo configurado por defecto
    const defaultPath = path.join(__dirname, CERT_FILENAME);
    if (fs.existsSync(defaultPath)) {
      return defaultPath;
    }

    const files = fs.readdirSync(__dirname);
    const certFile = files.find(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.crt' || ext === '.xml';
    });

    if (certFile) {
      return path.join(__dirname, certFile);
    }

    throw new Error(
      `[DteSigner] No se encontró el archivo de certificado en: "${__dirname}". ` +
      `Coloque el archivo .crt emitido por Hacienda en este mismo directorio o configure CERT_FILENAME.`
    );
  }

  /**
   * Obtiene el contenido XML del certificado.
   * 
   * @returns {string} Contenido XML en texto plano.
   */
  static getCertContent() {
    const cachedRaw = cache.get(CACHE_KEY_RAW_CERT);
    if (cachedRaw) {
      return cachedRaw;
    }
    const certPath = this.resolveCertFilePath();
    return fs.readFileSync(certPath, 'utf8');
  }

  /**
   * Parsea y valida el contenido de un certificado digital en XML (`.crt`) emitido por Hacienda.
   * Extrae la llave privada en formato PKCS#8 / DER y verifica la contraseña si fue configurada.
   * 
   * @param {string} crtXmlContent - Contenido de texto del archivo XML del certificado.
   * @param {string} [passwordPri] - Contraseña de la llave privada.
   * @returns {Promise<{nit: string, privateKey: crypto.KeyObject, rawXml: string}>}
   * @throws {Error} Si el XML no contiene la estructura <CertificadoMH> o si la contraseña no coincide.
   */
  static async parseHaciendaCert(crtXmlContent, passwordPri) {
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(crtXmlContent);
    const cert = result.CertificadoMH;

    if (!cert || !cert.privateKey) {
      throw new Error('Estructura <CertificadoMH> con <privateKey> no encontrada en el archivo');
    }

    if (passwordPri && cert.privateKey.clave) {
      const inputHash = crypto.createHash('sha512').update(passwordPri).digest('hex');
      const storedHash = cert.privateKey.clave;
      if (inputHash.toLowerCase() !== storedHash.toLowerCase()) {
        throw new Error(
          'Contraseña de la llave privada incorrecta. Verifique la variable CERT_PASSWORD al inicio del archivo o en .env'
        );
      }
    }

    // Extracción de la llave privada en Base64 DER PKCS#8
    const privateKeyDerB64 = cert.privateKey.encodied.replace(/\s+/g, '');
    const privateKeyDer = Buffer.from(privateKeyDerB64, 'base64');

    // Creación del KeyObject nativo de Node.js
    const privateKeyObject = crypto.createPrivateKey({
      key: privateKeyDer,
      format: 'der',
      type: 'pkcs8'
    });

    return {
      nit: cert.nit,
      privateKey: privateKeyObject,
      rawXml: crtXmlContent
    };
  }

  /**
   * Obtiene la llave privada procesada y los datos del certificado.
   * Utiliza 'memory-cache' para que el parseo y validación de hash se realice solo una vez.
   * 
   * @param {Object} [options] - Opciones opcionales de certificado.
   * @param {string} [options.password] - Contraseña alternativa.
   * @param {string} [options.certPath] - Ruta personalizada alternativa.
   * @returns {Promise<{nit: string, privateKey: crypto.KeyObject}>}
   */
  static async getCertificateData() {
    const cachedData = cache.get(CACHE_KEY_PARSED_DATA);
    if (cachedData) {
      return cachedData;
    }

    const xmlContent = this.getCertContent();
    const parsed = await this.parseHaciendaCert(xmlContent, CERT_PASSWORD);

    cache.put(CACHE_KEY_PARSED_DATA, parsed);

    return parsed;
  }

  /**
   * Obtiene directamente la llave privada en formato KeyObject nativo de Node.js.
   * 
   * @param {Object} [options] - Opciones opcionales.
   * @returns {Promise<crypto.KeyObject>}
   */
  static async getPrivateKey() {
    const certData = await this.getCertificateData();
    return certData.privateKey;
  }

  /**
   * Firma digitalmente el JSON de un DTE produciendo una cadena JWS Compacta RS512 oficial.
   * 
   * Flujo de firmado JWS (RFC 7515 / DGII El Salvador):
   * 1. Header: `{"alg":"RS512"}` -> Base64URL
   * 2. Payload: JSON del DTE en UTF-8 -> Base64URL
   * 3. Signing Input: `${HeaderB64}.${PayloadB64}`
   * 4. Signature: RSA-SHA512(SigningInput, PrivateKey) -> Base64URL
   * 5. JWS Compacto Final: `${SigningInput}.${SignatureB64}`
   * 
   * @param {Object|string} dteJson - Objeto o cadena JSON oficial del DTE.
   * @param {Object|string} [options] - Opciones opcionales (o contraseña de reemplazo).
   * @returns {Promise<{ jws: string, headerB64: string, payloadB64: string, signatureB64: string, signatureHex: string, nit: string }>}
   */
  static async signDte(dteJson) {
    // 1. Obtener datos del certificado y llave privada (desde caché o disco)
    const { privateKey, nit } = await this.getCertificateData();

    // 2. Construcción de cabecera JWS (algoritmo RS512 exigido por Hacienda)
    const header = { alg: 'RS512' };
    const headerB64 = this.base64UrlEncode(JSON.stringify(header));

    // 3. Construcción del cuerpo (Payload en Base64URL)
    const payloadString = typeof dteJson === 'string' ? dteJson : JSON.stringify(dteJson);
    const payloadB64 = this.base64UrlEncode(payloadString);

    // 4. Entrada de firma (Header.Payload)
    const signingInput = `${headerB64}.${payloadB64}`;

    // 5. Generación de firma digital RSA-SHA512
    const signer = crypto.createSign('RSA-SHA512');
    signer.update(signingInput, 'utf8');
    signer.end();

    const signatureBuffer = signer.sign(privateKey);
    const signatureB64 = this.base64UrlEncode(signatureBuffer);

    // 6. Ensamblaje del JWS Compacto final
    const jwsCompact = `${signingInput}.${signatureB64}`;

    return {
      data: jwsCompact,                                  // Cadena requerida por Hacienda en { "documento": jwsCompact }
      headerB64,
      payloadB64,
      signatureB64,
      signatureHex: signatureBuffer.toString('hex'),     // Firma en hexadecimal para trazabilidad y auditoría
      nit
    };
  }

  /**
   * Valida la firma digital de una cadena JWS Compacta utilizando la llave pública.
   * 
   * @param {string} jwsString - Cadena JWS en formato `Header.Payload.Signature`.
   * @param {string|crypto.KeyObject} publicKey - Llave pública PEM o KeyObject del emisor.
   * @returns {boolean} true si la firma es matemáticamente válida, false si fue alterada o es inválida.
   */
  static verifyJws(jwsString, publicKey) {
    try {
      const parts = jwsString.split('.');
      if (parts.length !== 3) return false;

      const [headerB64, payloadB64, signatureB64] = parts;
      const signingInput = `${headerB64}.${payloadB64}`;

      const sigB64 = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
      const signatureBuffer = Buffer.from(sigB64, 'base64');

      const verifier = crypto.createVerify('RSA-SHA512');
      verifier.update(signingInput, 'utf8');
      verifier.end();

      return verifier.verify(publicKey, signatureBuffer);
    } catch (err) {
      return false;
    }
  }

  /**
   * Limpia las entradas almacenadas en memory-cache.
   * Útil si se actualiza el archivo de certificado o se modifica la clave en tiempo de ejecución.
   */
  static clearCache() {
    cache.del(CACHE_KEY_RAW_CERT);
    cache.del(CACHE_KEY_PARSED_DATA);
  }
}

module.exports = DteSignerService;
