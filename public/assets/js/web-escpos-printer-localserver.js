// Reutilizamos el ESCPOSBuilder de las respuestas anteriores,
// ya que los comandos ESC/POS son independientes del método de conexión.
class ESCPOSBuilder {
      constructor() {
            this.buffer = [];
            this.currentFont = 'A'; // Predeterminado a Font A
            this.lineLength = 40;   // Predeterminado a 42 caracteres para Font A
      }

      // ... (Métodos existentes: initialize, align, text, newLine, newLineN, bold, doubleHeightWidth, cut, cashDrawer) ...

      // --- Nuevos métodos para la Fuente y el Largo de Línea ---

      /**
       * Selecciona la fuente de la impresora (Font A o Font B).
       * @param {string} font - 'A' para Font A (48 caracteres), 'B' para Font B (64 caracteres).
       */
      setFont(font = 'A') {
            let cmd;
            if (font.toUpperCase() === 'B') {
                  cmd = 0x01; // Comando para Font B
                  this.currentFont = 'B';
                  this.lineLength = 52;
            } else {
                  cmd = 0x00; // Comando para Font A
                  this.currentFont = 'A';
                  this.lineLength = 40;
            }
            this.buffer.push(0x1B, 0x4D, cmd);
            return this;
      }

      initialize() { 
            this.buffer.push(0x1B, 0x40); 
            this.buffer.push(0x1B, 0x74, 2); // Establecer codificación de caracteres a UTF-8
            
            return this;
      }
      align(position) {
            let cmd = 0x00; // Left
            if (position === 'center') { cmd = 0x01; } else if (position === 'right') { cmd = 0x02; }
            this.buffer.push(0x1B, 0x61, cmd); return this;
      }
      text(data) {
            const encoder = new TextEncoder();
            const encodedData = encoder.encode(data);
            this.buffer.push(...Array.from(encodedData)); return this;
      }
      newLine() { this.buffer.push(0x0A); return this; }
      newLineN(n) { for (let i = 0; i < n; i++) { this.buffer.push(0x0A); } return this; }
      bold(enable) { this.buffer.push(0x1B, 0x45, enable ? 0x01 : 0x00); return this; }
      doubleHeightWidth(enable) {
            if (enable) { this.buffer.push(0x1B, 0x21, 0x18); } else { this.buffer.push(0x1B, 0x21, 0x00); }
            return this;
      }
      cut(partial = false) {
            if (partial) { this.buffer.push(0x1D, 0x56, 0x01); } else { this.buffer.push(0x1D, 0x56, 0x00); }
            return this;
      }
      cashDrawer(pin = 2) {
            this.buffer.push(0x1B, 0x70, pin === 5 ? 0x01 : 0x00, 0x19, 0xFA);
            return this;
      }

      /**
       * Selecciona el modelo de código QR.
       * @param {number} model - 1 para Modelo 1, 2 para Modelo 2. (Modelo 2 es el más común)
       */
      qr_selectModel(model = 2) {
            // forzar la impresion de la linea actual
            this.buffer.push(0x0A);
            // GS ( k <L><H> <cn> <fn> <m>
            // L=0x03, H=0x00 (3 bytes siguientes)
            // cn=0x31 (49), fn=0x41 (65), m=0x31 (49) para Model 1, 0x32 (50) para Model 2
            this.buffer.push(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, (model === 1 ? 0x31 : 0x32), 0x00);
            return this;
      }

      /**
       * Establece el tamaño del módulo (dot size) del código QR.
       * @param {number} size - Tamaño en puntos (1 a 16). 3-8 es común.
       */
      qr_setModuleSize(size = 8) {
            // GS ( k <L><H> <cn> <fn> <n1>
            // L=0x03, H=0x00
            // cn=0x31 (49), fn=0x43 (67), n1 = size (1-16)
            this.buffer.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, size);
            return this;
      }

      /**
       * Establece el nivel de corrección de errores del código QR.
       * @param {string} level - 'L' (7%), 'M' (15%), 'Q' (25%), 'H' (30%). 'M' es el predeterminado.
       */
      qr_setErrorCorrectionLevel(level = 'M') {
            // GS ( k <L><H> <cn> <fn> <n1>
            // L=0x03, H=0x00
            // cn=0x31 (49), fn=0x45 (69), n1 = 0x30-0x33
            let n1;
            switch (level.toUpperCase()) {
                  case 'L': n1 = 0x30; break; // 7%
                  case 'M': n1 = 0x31; break; // 15% (default)
                  case 'Q': n1 = 0x32; break; // 25%
                  case 'H': n1 = 0x33; break; // 30%
                  default: n1 = 0x31; // Default a M
            }
            this.buffer.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, n1);
            return this;
      }

      /**
       * Almacena los datos para el código QR.
       * @param {string} data - La cadena de texto a codificar en el QR.
       */
      qr_storeData(data) {
            // GS ( k <L><H> <cn> <fn> <d1...dk>
            // L y H son la longitud de (cn + fn + data bytes)
            // cn=0x31 (49), fn=0x50 (80)
            const encoder = new TextEncoder();
            const encodedData = encoder.encode(data);

            // ¡¡¡CORRECCIÓN AQUÍ!!!
            // La longitud de los datos es la longitud de 'encodedData' MÁS 2 (por los bytes cn y fn).
            const dataLength = encodedData.length + 3;

            const L = dataLength & 0xFF; // Byte bajo de la longitud
            const H = (dataLength >> 8) & 0xFF; // Byte alto de la longitud

            this.buffer.push(
                  0x1D, 0x28, 0x6B, // GS ( k (Encabezado fijo del comando)
                  dataLength % 0xFF, dataLength / 0xFF,             // <L><H> (Longitud del payload, es decir, todo lo que sigue)
                  0x31,             // cn (Función 1 de códigos QR)
                  0x50,
                  0x30,             // fn (Función para almacenar datos 'P')
                  ...Array.from(encodedData) // Los bytes de tus datos del código QR
            );
            return this;
      }

      /**
       * Imprime el código QR almacenado.
       */
      qr_print() {
            // GS ( k <L><H> <cn> <fn>
            // L=0x03, H=0x00
            // cn=0x31 (49), fn=0x51 (81)
            this.buffer.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);
            return this;
      }

      /**
       * Método conveniente para generar e imprimir un código QR completo.
       * @param {string} data - La cadena de texto a codificar en el QR.
       * @param {number} [moduleSize=8] - Tamaño del módulo (1-16).
       * @param {string} [errorCorrectionLevel='M'] - Nivel de corrección ('L', 'M', 'Q', 'H').
       */
      qr(data, moduleSize = 8, errorCorrectionLevel = 'L') {
            return this.qr_selectModel(2)
                  .qr_setModuleSize(moduleSize)
                  .qr_setErrorCorrectionLevel(errorCorrectionLevel)
                  .qr_storeData(data)
                  .qr_print();
      }




      /**
       * Añade una línea formateada con nombre, cantidad, precio y total.
       * Este método es nuevo y ayuda a manejar las columnas automáticamente.
       *
       * @param {string} name - Nombre del producto.
       * @param {number} qty - Cantidad.
       * @param {number} price - Precio unitario.
       * @param {number} total - Total del ítem (qty * price).
       */
      itemLine(name, qty, price, itemTotal, model_ = 'double') {
            // Adaptar los largos de las columnas al largo total de la línea
            // Estos porcentajes son ejemplos, puedes ajustarlos según tu necesidad
            const nameLength = Math.floor(this.lineLength * 0.35); // 35% del largo total
            const qtyLength = Math.floor(this.lineLength * 0.15); // 15%
            const priceLength = Math.floor(this.lineLength * 0.25); // 25%
            const totalLength = this.lineLength - nameLength - qtyLength - priceLength; // El resto

            const formattedName = name.padEnd(nameLength).substring(0, nameLength);
            const formattedQty = String(qty).padStart(qtyLength).substring(0, qtyLength);
            const formattedPrice = String(price.toFixed(2)).padStart(priceLength).substring(0, priceLength);
            const formattedTotal = String(itemTotal.toFixed(2)).padStart(totalLength).substring(0, totalLength);

            this.text(`${formattedName}${formattedQty}${formattedPrice}${formattedTotal}`);
            return this;
      }

      /**
    * Establece la altura del código de barras.
    * @param {number} height - Altura en puntos (1-255). Por defecto 50-80.
    */
      barcode_setHeight(height = 50) {
            // GS h n (1D 68 n)
            this.buffer.push(0x1D, 0x68, height);
            return this;
      }

      /**
       * Establece el ancho del módulo (ancho de la barra más delgada).
       * @param {number} width - Ancho en puntos (2-6). Por defecto 2-3.
       */
      barcode_setModuleWidth(width = 2) {
            // GS w n (1D 77 n)
            this.buffer.push(0x1D, 0x77, width);
            return this;
      }

      /**
       * Establece la posición del texto (human readable text) del código de barras.
       * @param {string} position - 'none', 'above', 'below', 'both'.
       */
      barcode_setTextPosition(position = 'below') {
            // GS H n (1D 48 n)
            let cmd;
            switch (position) {
                  case 'above': cmd = 0x01; break;
                  case 'below': cmd = 0x02; break;
                  case 'both': cmd = 0x03; break;
                  case 'none':
                  default: cmd = 0x00; break;
            }
            this.buffer.push(0x1D, 0x48, cmd);
            return this;
      }

      /**
       * Selecciona la fuente del texto del código de barras.
       * @param {string} font - 'A' o 'B'.
       */
      barcode_setTextFont(font = 'A') {
            // GS f n (1D 66 n)
            this.buffer.push(0x1D, 0x66, font.toUpperCase() === 'B' ? 0x01 : 0x00);
            return this;
      }

      /**
       * Imprime un código de barras.
       * @param {string} data - Los datos del código de barras.
       * @param {string} type - Tipo de código de barras (ej. 'UPC-A', 'EAN13', 'CODE39', 'CODE128').
       * Los valores exactos dependen de la impresora.
       * Se mapean a los comandos ESC/POS específicos (GS k m d1...dk NUL).
       */
      barcode(data, type = 'EAN13') {
            const encoder = new TextEncoder();
            const encodedData = encoder.encode(data);
            let typeCmd;

            // Mapeo de tipos de código de barras a comandos ESC/POS (GS k m)
            // ESTOS VALORES SON EJEMPLOS COMUNES, VERIFICA EL MANUAL DE TU IMPRESORA.
            switch (type.toUpperCase()) {
                  case 'UPC-A': typeCmd = 0x00; break;
                  case 'UPC-E': typeCmd = 0x01; break;
                  case 'EAN13': typeCmd = 0x02; break; // ¡Muy común!
                  case 'EAN8': typeCmd = 0x03; break;
                  case 'CODE39': typeCmd = 0x04; break;
                  case 'ITF': typeCmd = 0x05; break;
                  case 'CODABAR': typeCmd = 0x06; break;
                  case 'CODE93': typeCmd = 0x48; break; // GS k 72
                  case 'CODE128': typeCmd = 0x49; break; // GS k 73 ¡Muy común!
                  default: typeCmd = 0x02; // Default a EAN13
                        console.warn(`Tipo de código de barras '${type}' no reconocido, usando EAN13 por defecto.`);
                        break;
            }

            // GS k m d1...dk NUL (para la mayoría de tipos de código de barras)
            // Algunos tipos como CODE128 tienen un formato diferente (GS k m n d1...dk)
            // Para simplificar, usamos el formato general de data + NUL.
            // Si necesitas CODE128, considera una implementación más específica si este no funciona.

            if (typeCmd >= 0x48) { // Estos son para GS k m n d1...dk
                  // GS k m n d1...dk
                  // m es el tipo de código de barras
                  // n es la longitud de los datos
                  this.buffer.push(0x1D, 0x6B, typeCmd, encodedData.length, ...Array.from(encodedData));
            } else { // Para los tipos más antiguos (GS k m d1...dk NUL)
                  this.buffer.push(0x1D, 0x6B, typeCmd, ...Array.from(encodedData), 0x00);
            }

            return this;
      }


      // --- Nuevos métodos para Impresión de Imágenes (Logotipos) ---

      /**
       * Imprime una imagen bitmap.
       * Convierte los datos de imagen en comandos ESC/POS (GS v 0).
       *
       * @param {ImageData} imageData - Objeto ImageData que contiene los píxeles (ej. de un CanvasRenderingContext2D.getImageData()).
       * DEBE SER UNA IMAGEN BLANCO Y NEGRO para obtener los mejores resultados.
       * El método se encarga de umbralizar y convertir a 1-bit.
       * @param {number} [threshold=128] - Umbral para convertir a blanco y negro (0-255).
       * Los píxeles más oscuros que este valor se convierten en negro.
       * @returns {ESCPOSBuilder}
       */
      image(imageData, threshold = 128) {
            const { width, height, data } = imageData;

            // Asegurarse de que el ancho sea un múltiplo de 8 (requerido por algunas impresoras)
            const bytesPerRow = Math.ceil(width / 8);
            const paddedWidth = bytesPerRow * 8;

            const bitmap = new Uint8Array(bytesPerRow * height);
            let byteIndex = 0;

            for (let y = 0; y < height; y++) {
                  for (let x = 0; x < paddedWidth; x += 8) {
                        let currentByte = 0;
                        for (let bit = 0; bit < 8; bit++) {
                              const pixelX = x + bit;
                              if (pixelX < width) {
                                    const i = (y * width + pixelX) * 4; // Índice en el array RGBA
                                    const r = data[i];
                                    const g = data[i + 1];
                                    const b = data[i + 2];
                                    const avg = (r + g + b) / 3; // Promedio de color

                                    // Si el píxel es lo suficientemente oscuro, es negro (1); de lo contrario, blanco (0)
                                    if (avg < threshold) {
                                          currentByte |= (0x80 >> bit); // Establece el bit correspondiente (MSB primero)
                                    }
                              }
                        }
                        bitmap[byteIndex++] = currentByte;
                  }
            }

            // Comandos para imprimir gráficos raster bit-image (GS v 0)
            // GS v 0 m xL xH yL yH d1...dk
            // m = 0 para modo normal
            // xL, xH = ancho en bytes (paddedWidth / 8)
            // yL, yH = altura en puntos (height)
            // d1...dk = datos de la imagen

            const xL = bytesPerRow & 0xFF;
            const xH = (bytesPerRow >> 8) & 0xFF;
            const yL = height & 0xFF;
            const yH = (height >> 8) & 0xFF;

            this.buffer.push(0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH, ...Array.from(bitmap));
            return this;
      }


      build() { return new Uint8Array(this.buffer); }
}


class WebPOSPrinterLocalServer {
      constructor(serverUrl = 'http://localhost:4567/print') {
            this.serverUrl = serverUrl; // URL del endpoint del servidor Java
      }

      // El método connect ahora solo verifica la conectividad al servidor Java
      async connect() {
            try {
                  const response = await fetch(this.serverUrl, { method: 'OPTIONS' }); // Petición OPTIONS para verificar CORS/conectividad
                  if (response.status === 204 || response.status === 200) {
                        return true;
                  } else {
                        console.error('Servidor de impresión local no responde como se esperaba. Estado:', response.status);
                        return false;
                  }
            } catch (error) {
                  console.error('Error al conectar con el servidor de impresión local:', error);
                  console.warn('Asegúrate de que el servidor Java (PrinterServer.java) esté ejecutándose y accesible en ' + this.serverUrl);
                  return false;
            }
      }

      async disconnect() {
            return true;
      }

      /**
       * Envía comandos ESC/POS a la impresora a través del servidor Java.
       * @param {Uint8Array} commands - Los comandos ESC/POS en formato Uint8Array.
       * @returns {Promise<void>}
       */
      async sendCommands(commands) {
            try {
                  // Convertir Uint8Array a una cadena Base64
                  const base64Commands = btoa(String.fromCharCode.apply(null, commands));

                  const response = await fetch(this.serverUrl, {
                        method: 'POST',
                        headers: {
                              'Content-Type': 'text/plain' // O 'application/json' si decides enviar JSON con la cadena Base64 dentro
                        },
                        body: base64Commands // Enviar la cadena Base64 como cuerpo de la petición
                  });

                  if (response.ok) { // response.status >= 200 && response.status < 300
                        const resultText = await response.text();
                        return resultText; // Retorna el texto de respuesta del servidor
                  } else {
                        const errorText = await response.text();
                        console.error('Error al enviar comandos al servidor:', response.status, errorText);
                        throw new Error(`Error del servidor (${response.status}): ${errorText}`);
                  }
            } catch (error) {
                  console.error('Error al enviar comandos al servidor de impresión:', error);
                  throw error;
            }
      }

      /**
       * Imprime un ticket de ejemplo usando los comandos ESC/POS.
       * @param {Object} options - Opciones para el ticket.
       * @param {string} options.storeName - Nombre de la tienda.
       * @param {string} options.ticketNumber - Número de ticket.
       * @param {Array<Object>} options.items - Lista de productos {name: string, qty: number, price: number}.
       * @param {number} options.total - Total de la compra.
       */
      async printExampleTicket({ storeName, ticketNumber, items, total }) {

      }
}

// Exportar la clase para que pueda ser usada en otros archivos JS
window.WebPOSPrinterLocalServer = WebPOSPrinterLocalServer;