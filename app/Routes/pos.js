const router = require("express").Router();

const DTEController = require("../DTE/Controllers/DTEController");
const PosController = require("../CRM/Controllers/PosController");
const Auth = require('../System/Middleware/Auth');

/**Providers Routes */
router.get('/', PosController.posMode);
router.post('/', PosController.processOrder);
router.get('/client_select2', PosController.getClientToSelect2);
router.get('/getClient', PosController.getClient);
router.get('/getOrder', PosController.getOrder);
router.get('/ordersToBeBilled', PosController.ordersToBeBilled);
router.get('/ordersGuides', PosController.ordersGuides);
router.post('/ordersGuides', PosController.marcarGuia);
router.get('/viewDTE/:id(\\d+)', PosController.view_any_dte);
router.get('/getPdf/:id(\\d+)', PosController.streamDTEPdf);
router.get('/getPdf/:uuid/:fecha(\\d{4}-\\d{2}-\\d{2})', PosController.streamDTEPdf);
router.post('/resend_dte_email', PosController.resend_dte_email);
router.get('/getJson/:id(\\d+)', PosController.getJsonById);
router.get('/getJson/:uuid/:fecha(\\d{4}-\\d{2}-\\d{2})', PosController.getDTEJsonByCOde);


router.get('/create_manual/:dte', PosController.create_manual_fc);
// router.post('/procces_dte_manual', PosController.simular_contingencia);
router.post('/procces_dte_manual', PosController.process_manual_dte);
router.post('/invalidation_event', PosController.invalidation_dte);
//router.get('/contingencia_event', PosController.contingencia_event);
router.get('/consulta_no_transmitidos', PosController.no_transmitidos);
// router.get('/test', PosController.aaaaaaaaaaaa);


router.get('/report', PosController.dte_report);
router.post('/report', PosController.dte_report_data);
router.get('/cost_report', PosController.dte_cost_report);
router.post('/cost_report', PosController.dte_cost_report_data);


router.get('/test_wkhtmltopdf', (req, res) => {
    const wkhtmltopdf = require("wkhtmltopdf");
    try {
        wkhtmltopdf.command = "C:/Program Files/wkhtmltopdf/bin/wkhtmltopdf.exe";
        // wkhtmltopdf.command = path.join(__dirname, '..', 'System', 'wkhtmltopdf');

        const html = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; padding: 30px; color: #222; }
                    .box { border: 2px solid #198754; border-radius: 8px; padding: 20px; }
                    h1 { color: #198754; margin-top: 0; }
                    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; }
                </style>
            </head>
            <body>
                <div class="box">
                    <h1>wkhtmltopdf funciona correctamente</h1>
                    <p><strong>Fecha de prueba:</strong> ${new Date().toLocaleString('es-SV')}</p>
                    <p><strong>Comando configurado:</strong> <code>${wkhtmltopdf.command || 'wkhtmltopdf (PATH)'}</code></p>
                    <p><strong>Ambiente DTE:</strong> <code>${process.env.DTE_AMBIENTE || 'N/A'}</code></p>
                </div>
            </body>
            </html>
        `;

        const chunks = [];
        const stream = wkhtmltopdf(html, {
            pageSize: 'Letter',
            encoding: 'UTF-8',
        });

        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            if (req.query.json === '1') {
                return res.json({
                    status: 'success',
                    message: 'wkhtmltopdf generó el PDF correctamente',
                    command: wkhtmltopdf.command,
                    bytes: pdfBuffer.length,
                });
            }
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="test_wkhtmltopdf.pdf"');
            return res.send(pdfBuffer);
        });

        stream.on('error', (err) => {
            console.error('Error en test_wkhtmltopdf:', err);
            if (!res.headersSent) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Fallo al ejecutar wkhtmltopdf',
                    command: wkhtmltopdf.command,
                    error: err.message,
                });
            }
        });
    } catch (err) {
        return res.status(500).json({
            status: 'error',
            message: 'Excepción al intentar probar wkhtmltopdf',
            command: wkhtmltopdf.command,
            error: err.message,
        });
    }
});



//  router.post('/data_to_test', PosController.data_generar_pruebas);




module.exports = router;