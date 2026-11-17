const { Resend } = require("resend");
const path = require("path");
const fs = require("fs");
const util = require("util");
const ejs = require("ejs");
const QRCode = require("qrcode");
const wkhtmltopdf = require("wkhtmltopdf");

const DTE_Model = require("../Models/DTE");
const Sucursal = require("../../Inventory/Models/Sucursal");
const municipios = require("../Catalogos/municipios.json");
const departamentos = require("../Catalogos/departamentos.json");
const documentos = require("../Catalogos/tipo_documento.json");

const renderFileAsync = util.promisify(ejs.renderFile);
const resend = new Resend(process.env.RESEND_API_KEY);

//const directorio = path.join(__dirname, '..', '..', 'System', 'wkhtmltopdf');
//wkhtmltopdf.command = "C:/Program Files/wkhtmltopdf/bin/wkhtmltopdf.exe";
// wkhtmltopdf.command = '/usr/bin/wkhtmltopdf';

function generatePdfBuffer(htmlContent) {
      return new Promise((resolve, reject) => {
            wkhtmltopdf.command = directorio;
            const chunks = [];
            const stream = wkhtmltopdf(htmlContent, {
                  pageSize: "Letter",
                  marginTop: "10mm",
                  marginBottom: "10mm",
                  marginLeft: "10mm",
                  marginRight: "10mm",
                  encoding: "UTF-8",
            });

            stream.on("data", (chunk) => chunks.push(chunk));
            stream.on("end", () => resolve(Buffer.concat(chunks)));
            stream.on("error", (err) => reject(err));
      });
}

function formatDireccion(dir) {
      if (!dir) return "";
      const dep = departamentos[dir.departamento]?.toUpperCase() || "";
      const mun = municipios[dir.departamento]?.[dir.municipio] || "";
      return [dir.complemento, mun, dep].filter(Boolean).join(", ");
}

/**
 * Envía por correo electrónico el archivo .json y el archivo .pdf de un DTE.
 * @param {Object} params - Objeto con { id | dte | json, correocustom }
 * @returns {Promise<Object|boolean>} Retorna false si no hay destinatario o documento válido, o el resultado del envío.
 */
async function sendDteEmail(params = {}) {


      try {
            if (!params || typeof params !== "object") {
                  return false;
            }

            let dteRecord = null;
            let dte_json = null;

            // 1. Resolver el DTE por ID de la tabla o por JSON proporcionado
            const idParam = params.id ?? params.dte_id ?? params.dteId ?? (typeof params.dte === "number" || (typeof params.dte === "string" && /^\d+$/.test(params.dte)) ? params.dte : null);
            const rawDteObj = params.json ?? (typeof params.dte === "object" && params.dte !== null ? params.dte : null) ?? params.dteJson ?? null;

            if (idParam !== null && idParam !== undefined) {
                  dteRecord = await DTE_Model.findByPk(idParam);
                  if (!dteRecord || !dteRecord.dte) {
                        return false;
                  }
                  dte_json = dteRecord.dte;
                  dte_json.responseMH = dteRecord.responseMH;
            } else if (rawDteObj) {
                  // Si se pasó la tupla completa del modelo DTE (contiene .dte interno)
                  if (rawDteObj.dte && !rawDteObj.identificacion) {
                        dteRecord = rawDteObj;
                        dte_json = typeof rawDteObj.dte === "string" ? JSON.parse(rawDteObj.dte) : { ...rawDteObj.dte };
                        dte_json.responseMH = rawDteObj.responseMH ?? dte_json.responseMH;
                  } else {
                        dte_json = { ...rawDteObj };
                  }
            } else if (params.identificacion) {
                  dte_json = { ...params };
            }

            if (!dte_json || !dte_json.identificacion || !dte_json.identificacion.codigoGeneracion) {
                  return false;
            }

            // 2. Validar destinatario: correocustom o receptor.correo
            let destinatario = params.correocustom ?? params.correoCustom ?? params.correo_custom ?? null;
            if (!destinatario || String(destinatario).trim() === "") {
                  const correoReceptor = dte_json.receptor?.correo ?? dte_json.sujetoExcluido?.correo ?? null;
                  if (!correoReceptor || String(correoReceptor).trim() === "") {
                        return false;
                  }
                  destinatario = String(correoReceptor).trim();
            } else {
                  destinatario = String(destinatario).trim();
            }

            if (!dteRecord && dte_json.responseMH === undefined && dte_json.identificacion?.codigoGeneracion) {
                  dteRecord = await DTE_Model.findOne({
                        where: { codigo: dte_json.identificacion.codigoGeneracion },
                  }).catch(() => null);
                  if (dteRecord) {
                        dte_json.responseMH = dteRecord.responseMH;
                  }
            }

            // 3. Preparar datos para renderizar la vista PDF
            const codigoGeneracion = dte_json.identificacion.codigoGeneracion;
            const tipoDte = String(dteRecord?.tipo || dte_json.identificacion.tipoDte || dte_json.identificacion.tipoEvento || "01");
            const fecEmi = dte_json.identificacion.fecEmi || dte_json.identificacion.fTransmision || "";

            let sucursal = null;
            if (dteRecord?.sucursal) {
                  sucursal = await Sucursal.findByPk(dteRecord.sucursal).catch(() => null);
            }
            if (!sucursal) {
                  sucursal = await Sucursal.findOne().catch(() => null);
            }

            const qrUrl = `https://admin.factura.gob.sv/consultaPublica?ambiente=${dte_json.identificacion.ambiente}&codGen=${codigoGeneracion}&fechaEmi=${fecEmi}`;
            const base64String = await QRCode.toDataURL(qrUrl, {
                  errorCorrectionLevel: "L",
                  type: "image/png",
                  quality: 0.85,
                  margin: 1,
                  color: {
                        dark: "#000000",
                        light: "#FFFFFF",
                  },
            });

            let receptor = null;
            if (tipoDte === "14" && dte_json.sujetoExcluido) {
                  receptor = {
                        documento:
                              dte_json.sujetoExcluido.tipoDocumento && dte_json.sujetoExcluido.numDocumento
                                    ? `${documentos[dte_json.sujetoExcluido.tipoDocumento]} (${dte_json.sujetoExcluido.numDocumento})`
                                    : dte_json.sujetoExcluido.numDocumento || "",
                        direccion: formatDireccion(dte_json.sujetoExcluido.direccion),
                  };
            } else if (dte_json.receptor) {
                  receptor = {
                        documento:
                              dte_json.receptor.tipoDocumento && dte_json.receptor.numDocumento
                                    ? `${documentos[dte_json.receptor.tipoDocumento]} (${dte_json.receptor.numDocumento})`
                                    : dte_json.receptor.numDocumento || dte_json.receptor.nit || "",
                        direccion: formatDireccion(dte_json.receptor.direccion) || dte_json.receptor.complemento || "",
                  };
            }

            const data = {
                  emisor_direction: formatDireccion(dte_json.emisor?.direccion),
                  receptor,
            };

            // Determinar carpeta de versión de la vista PDF
            const rawPdfVersion = dteRecord && typeof dteRecord.getDataValue === "function"
                  ? dteRecord.getDataValue("pdf_version")
                  : dteRecord?.pdf_version;
            const versionFolder =
                  rawPdfVersion && rawPdfVersion !== "old"
                        ? `v${rawPdfVersion}`
                        : dte_json.identificacion.version
                              ? `v${dte_json.identificacion.version}`
                              : "old";

            let filePath = path.join(__dirname, "..", "..", "views", "POS", "pdf_views", versionFolder, `${tipoDte}.ejs`);
            if (!fs.existsSync(filePath)) {
                  filePath = path.join(__dirname, "..", "..", "views", "POS", "pdf_views", "old", `${tipoDte}.ejs`);
            }

            const dteForRender = {
                  ...dte_json,
                  selloRecibido: dte_json.selloRecibido || dte_json.responseMH?.selloRecibido || null,
                  responseMH: dte_json.responseMH || { fhProcesamiento: "" },
            };

            const html = await renderFileAsync(filePath, {
                  pageTitle: `DTE ${codigoGeneracion}`,
                  sucursal: sucursal ? sucursal.name : "",
                  dte: dteForRender,
                  pdf_service: process.env.PDF_GENERATION_URL,
                  email_service: process.env.EMAIL_SERVICE_URL,
                  qrImage: base64String,
                  qrUrl,
                  data,
                  Helper: {
                        money_format: (n, digits = 2) => {
                              return new Intl.NumberFormat("es-SV", {
                                    style: "decimal",
                                    currency: "USD",
                                    minimumFractionDigits: digits,
                              }).format(Number(n || 0));
                        },
                        format_date: (_date, time = true) => {
                              let date = new Date(_date);
                              let day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate();
                              let month = date.getMonth() + 1;
                              month = month < 10 ? `0${month}` : month;
                              if (time) {
                                    let hours = date.getHours();
                                    let am = "AM";
                                    if (hours > 12) {
                                          hours = hours - 12;
                                          am = "PM";
                                    }
                                    let minutes = date.getMinutes();
                                    minutes = minutes < 10 ? `0${minutes}` : minutes;
                                    return `${day}/${month}/${date.getFullYear()} ${hours}:${minutes} ${am}`;
                              }
                              return `${day}/${month}/${date.getFullYear()}`;
                        },
                  },
            });

            // 4. Generar PDF con wkhtmltopdf y codificar ambos archivos
            const pdfBuffer = await generatePdfBuffer(html);
            const jsonContent = JSON.stringify(dte_json, null, 2);

            const from = "Facturación Electrónica<facturacion@riverasgroup.com>";
            const client_name = dte_json.receptor?.nombre || dte_json.sujetoExcluido?.nombre || "Cliente";
            const date = fecEmi;
            const code = codigoGeneracion;
            const currentYear = new Date().getFullYear();

            const emailHtml = `<!DOCTYPE html>
<html lang="ES-MX">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Factura Electronica</title>
</head>
<body
    style="font-family:Inter,sans-serif;margin:0;padding:16px;background-color:#f3f4f6;display:flex;justify-content:center;align-items:center;min-height:100vh">
    <div
        style="max-width:768px;width:100%;background-color:#fff;border-radius:8px;box-shadow:0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -2px rgba(0,0,0,.05);overflow:hidden">
        <div style="padding:24px;background-color:#f9fafb;color:#1f2937;line-height:1.625;font-size:16px">
            <h1 style="text-align: center; font-weight: bolder;">Riveras Group</h1>
            <h3 style="text-align: center;">
                DOCUMENTO TRIBUTARIO ELECTRONICO
            </h3>
            <p style="margin-bottom: 16px">
                Estimado/a ${client_name},
            </p>
            <p style="margin-bottom: 16px">
                Por este Medio enviamos su DTE:
            </p>
            <ul style="list-style-type: disc;
            list-style-position: inside;
            margin-bottom: 24px;
            padding-left: 16px;
            line-height: 1.5">
                <li style="margin-bottom:8px"><strong style=" color: #02091a">Fecha de Emision:</strong> ${date}
                </li>
                <li style="margin-bottom:8px"><strong style=" color: #02091a">Código de Generación:</strong>
                    ${code}</li>
            </ul>
            <p style="margin-bottom: 16px">
                Si tienes alguna pregunta o necesitas asistencia adicional, no dudes en contactar a nuestro equipo de
                soporte. Estamos aquí para ayudarte.
            </p>
            
        </div>
        <div style="padding:40px; background-color: #1f2937;
            padding: 24px;
            color: #d1d5db;
            font-size: 12px;
            text-align: center;
            border-bottom-left-radius: 8px;
            border-bottom-right-radius: 8px">
            <p style="color:#fff">
                <strong style="color:white;">Nota de Confidencialidad:</strong> Este mensaje y sus anexos son
                confidenciales y pueden contener información privilegiada. Si usted no es el destinatario previsto, por
                favor, notifique al remitente y elimine este correo. La distribución, copia o uso de esta información
                está estrictamente prohibida.
            </p>
            
            <p style="color:#9ca3af">&copy; ${currentYear} Riveras Group.</p>
        </div>
    </div>
</body>
</html>`;

            const { data: emailData, error } = await resend.emails.send({
                  from,
                  to: [destinatario],
                  subject: `Documento Tributario Electrónico - ${codigoGeneracion}`,
                  html: emailHtml,
                  attachments: [
                        {
                              filename: `${codigoGeneracion}.json`,
                              content: Buffer.from(jsonContent, "utf-8").toString("base64"),
                        },
                        {
                              filename: `${codigoGeneracion}.pdf`,
                              content: pdfBuffer.toString("base64"),
                        },
                  ],
            });

            if (error) {
                  console.error("Error sending DTE email:", error);
                  return {
                        status: "error",
                        message: "Failed to send email",
                        error,
                  };
            }

            return {
                  status: "success",
                  message: "Email sent successfully",
                  data: emailData,
            };
      } catch (err) {
            console.error("Error in sendDteEmail:", err);
            return {
                  status: "error",
                  message: err.message || "Failed to send email",
                  error: err,
            };
      }
}

async function testMail() {
      const from = "Facturación Electrónica<facturacion@riverasgroup.com>";

      // Create sample file content
      const fileContent = `Sample Attachment\n==================\n\nThis file was attached to your email.\nSent at: ${new Date().toISOString()}\n`;
      const encoded = Buffer.from(fileContent).toString("base64");

      // Maximum total attachment size: 40MB
      const { data, error } = await resend.emails.send({
            from,
            to: ["luisrivera4540@gmail.com"],
            subject: "Email with Attachment",
            html: "<h1>Your attachment is ready</h1><p>Please find the file attached to this email.</p>",
            attachments: [
                  {
                        filename: "sample.txt",
                        content: encoded,
                  },
            ],
      });

      if (error) {
            console.error("Error sending email:", error);
            return {
                  status: 'error',
                  message: 'Failed to send email',
                  error: error,
            };
      }
      return {
            status: 'success',
            message: 'Email sent successfully',
            data: data,
      };
}


module.exports = {
      testMail,
      sendDteEmail,
      sendDTE: sendDteEmail,
};
