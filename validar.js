const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

async function validarEntorno() {
    try {
        console.log("=== Probando UUID ===");
        const idGenerado = uuidv4();
        console.log(`✅ UUID v4 generado con éxito: ${idGenerado}`);

        console.log("\n=== Probando Sharp ===");
        // Generamos una imagen de 100x100 píxeles color rojo en memoria
        const { data, info } = await sharp({
            create: {
                width: 100,
                height: 100,
                channels: 4,
                background: { r: 255, g: 0, b: 0, alpha: 1 }
            }
        })
        .png()
        .toBuffer({ resolveWithObject: true });

        console.log(`✅ Sharp está funcionando. Imagen renderizada: ${info.width}x${info.height} formato ${info.format}`);
        console.log(`✅ Peso del buffer en memoria: ${data.length} bytes`);

        console.log("\n🚀 Las librerías críticas están listas para Node 26.");
    } catch (error) {
        console.error("\n❌ Error durante la validación:", error);
    }
}

validarEntorno();