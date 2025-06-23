const express = require('express');
const fs = require('fs');
const wkhtmltopdf = require('wkhtmltopdf');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch'); // En Node.js <18, necesario

const app = express();
const port = 3000;

// Middleware para parsear JSON
app.use(express.json());

// Función para generar el PDF
const generatePDF = (htmlContent, outputPath) => {
      return new Promise((resolve, reject) => {
            wkhtmltopdf(htmlContent, { output: outputPath }, (err) => {
                  if (err) reject(err);
                  else resolve(outputPath);
            });
      });
};

// Función para enviar correo electrónico con el PDF adjunto
const sendEmail = async (email, filePath) => {
      const transporter = nodemailer.createTransport({
            service: 'gmail', // Cambia según tu proveedor de correo
            auth: {
                  user: '<your_email>@gmail.com',
                  pass: '<your_password>' // Usa variables de entorno para mayor seguridad
            }
      });

      const mailOptions = {
            from: '<your_email>@gmail.com',
            to: email,
            subject: 'Aquí tienes tu PDF adjunto',
            text: 'Por favor, encuentra el archivo adjunto.',
            attachments: [
                  {
                        filename: 'archivo.pdf',
                        path: filePath
                  }
            ]
      };

      return transporter.sendMail(mailOptions);
};

// Función para enviar el PDF por WhatsApp
const sendWhatsApp = async (phoneNumber, filePath) => {
      // Subir el archivo para obtener el media_id
      const uploadResponse = await fetch('https://graph.facebook.com/v17.0/<YOUR_PHONE_NUMBER_ID>/media', {
            method: 'POST',
            headers: {
                  'Authorization': `Bearer <YOUR_ACCESS_TOKEN>`,
            },
            body: fs.createReadStream(filePath) // El archivo PDF
      });

      const mediaData = await uploadResponse.json();
      const mediaId = mediaData.id;

      // Enviar el mensaje con el archivo adjunto
      const messageResponse = await fetch(`https://graph.facebook.com/v17.0/<YOUR_PHONE_NUMBER_ID>/messages`, {
            method: 'POST',
            headers: {
                  'Authorization': `Bearer <YOUR_ACCESS_TOKEN>`,
                  'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  to: phoneNumber,
                  type: 'document',
                  document: {
                        id: mediaId,
                        caption: 'Aquí tienes el archivo adjunto.'
                  }
            })
      });

      return messageResponse.json();
};

// Ruta para generar el PDF y enviarlo
app.post('/handle-pdf', async (req, res) => {
      const { email, phoneNumber } = req.body;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>PDF Generado</title>
            <style>
                body { font-family: Arial, sans-serif; }
                h1 { color: #007BFF; }
            </style>
        </head>
        <body>
            <h1>¡Hola! Aquí tienes tu PDF</h1>
            <p>Este archivo ha sido generado y enviado por correo y WhatsApp.</p>
        </body>
        </html>
    `;

      const pdfPath = './archivo.pdf';

      try {
            // Generar el PDF
            await generatePDF(htmlContent, pdfPath);

            // Enviar el PDF por correo
            await sendEmail(email, pdfPath);

            // Enviar el PDF por WhatsApp
            await sendWhatsApp(phoneNumber, pdfPath);

            // Responder éxito
            res.status(200).json({ success: true, message: 'PDF enviado por correo y WhatsApp.' });

            // Eliminar el archivo temporal
            fs.unlinkSync(pdfPath);
      } catch (error) {
            res.status(500).json({ success: false, error: error.message });
      }
});

app.listen(port, () => {
      console.log(`Servidor corriendo en http://localhost:${port}`);
});