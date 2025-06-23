const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const wkhtmltopdf = require('wkhtmltopdf');
const QRCode = require('qrcode');
require('dotenv').config();
const sequelize = require("./app/DataBase/DataBase");
const Sale = require('../CRM/Models/Sale');
const rutaPlantilla = './template.ejs';

const id = process.argv[2];

if (!id) {
      console.error('Por favor, proporciona un ID como argumento.');
      process.exit(1);
}

(async () => {
      await obtenerVentaYGenerarPDF(id);
      process.exit(0);
})();


async function obtenerVentaYGenerarPDF(id) {
      try {
            // Buscar la venta por ID
            const venta = await Sale.findByPk(id);

            // Validar que la venta exista y que el campo "enviado" sea null
            if (!venta) {
                  throw new Error(`No se encontró una venta con el ID ${id}`);
            }
            if (venta.enviado !== null) {
                  throw new Error(`La venta con ID ${id} ya ha sido enviada`);
            }

            let complited = await generarPDF(venta.dte);

            if (complited) {
                  // Actualizar el campo "enviado" a true
                  await venta.update({ enviado: true });

            }
      } catch (error) {
            console.error('Error al obtener la venta o generar el PDF:', error.message);
      }
};


async function generarPDF(venta) {
      try {
            // Crear el objeto de datos para la plantilla
            dte_name = venta.dte_name;
            const datos = {
                  dte: venta,
                  qrCode: await QRCode.toDataURL('https://example.com') // Generar el código QR
            };
            // Renderizar la plantilla EJS a HTML
            const html = await ejs.renderFile(rutaPlantilla, datos);

            // Generar el PDF usando wkhtmltopdf
            const pdfPath = path.join(__dirname, 'temp', `${dte_name}.pdf`);
            await new Promise((resolve, reject) => {
                  wkhtmltopdf(html, { output: pdfPath }, (err) => {
                        if (err) return reject(err);
                        resolve(pdfPath);
                  });
            });

            // Guardar los datos de la venta en un archivo JSON
            const jsonPath = path.join(__dirname, 'temp', `${dte_name}.json`);
            fs.writeFileSync(jsonPath, JSON.stringify(venta, null, 2));

            return await sendPDFEmail(venta, pdfPath, jsonPath);
      } catch (error) {
            console.error('Error al generar el PDF:', error.message);

            return false;
      }
};

// Enviar el PDF por correo electrónico
async function sendPDFEmail(venta, pdfPath, jsonPath) {
      try {
            // Configurar el transporte de nodemailer
            const transporter = nodemailer.createTransport({
                  host: process.env.SMTP_HOST,
                  port: process.env.SMTP_PORT,
                  secure: process.env.SMTP_SECURE === 'true', // true para 465, false para otros puertos
                  auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                  }
            });

            // Crear el objeto de datos para la plantilla del correo
            const emailData = {
                  nombre: venta.clienteNombre,
                  total: venta.total
            };

            // Renderizar la plantilla EJS para el cuerpo del correo
            const emailHtml = await ejs.renderFile(path.join(__dirname, 'emailTemplate.ejs'), emailData);

            // Configurar el correo electrónico
            const mailOptions = {
                  from: process.env.SMTP_FROM,
                  to: venta.clienteEmail,
                  subject: `Factura de su compra - Venta ID: ${venta.id}`,
                  html: emailHtml,
                  attachments: [
                        {
                              filename: `venta_${venta.id}.pdf`,
                              path: pdfPath
                        },
                        {
                              filename: 'terms_and_conditions.pdf',
                              path: jsonPath
                        }
                  ]
            };

            // Enviar el correo
            await transporter.sendMail(mailOptions);

            // Eliminar los archivos adjuntos después de enviar el correo
            fs.unlinkSync(pdfPath);
            fs.unlinkSync(jsonPath);
            return true;
      } catch (error) {
            console.log(error);
            return false;
      }
};