// Dropdown Sidebar Menu
let sidebarItems = document.querySelectorAll('.sidebar-item.has-sub');
for (var i = 0; i < sidebarItems.length; i++) {
    let sidebarItem = sidebarItems[i];
    sidebarItems[i].querySelector('.sidebar-link').addEventListener('click', function (e) {
        e.preventDefault();

        let submenu = sidebarItem.querySelector('.submenu');

        if (submenu.classList.contains('active')) submenu.classList.remove('active');
        else submenu.classList.add('active');
    })
}

// Navbar Toggler
let sidebarToggler = document.querySelectorAll(".sidebar-toggler");
for (var i = 0; i < sidebarToggler.length; i++) {
    let toggler = sidebarToggler[i];
    toggler.addEventListener('click', () => {
        let sidebar = document.getElementById('sidebar');
        if (sidebar.classList.contains('active')) sidebar.classList.remove('active');
        else sidebar.classList.add('active');
    });
}

// Perfect Scrollbar INit
if (typeof PerfectScrollbar == 'function') {
    const container = document.querySelector(".sidebar-wrapper");
    const ps = new PerfectScrollbar(container);
}

window.onload = function () {

    var w = window.innerWidth;
    if (w < 768) {
        document.getElementById('sidebar').classList.remove('active');
    }
}

// Ejemplo implementando el metodo POST:
const postData = async (url = '', data = {}) => {
    // Opciones por defecto estan marcadas con un *
    const response = await fetch(url, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {
            'Content-Type': 'application/json'
            // 'Content-Type': 'application/x-www-form-urlencoded',
        },
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        body: JSON.stringify(data) // body data type must match "Content-Type" header
    });
    return response.json(); // parses JSON response into native JavaScript objects
}

/*dark mode switching*/
const setDarkMode = () => {
    control = document.getElementById("darkModeControl");
    if (!control.checked) {
        document.body.classList.remove("dark");
        control.checked = false;
    } else {
        document.body.classList.add("dark");
        control.checked = true;
    }

    //enviar cambio para ser guardado
    postData('/user/updatePreferences', { case: 'darkMode', value: control.checked });


}


/**Validations */

const isUrl = s => {
    var regexp = /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/
    if (regexp.test(s) && (s.indexOf('.png') != 1 || s.indexOf('.jpg'))) {
        return true;
    }
    return false;
}

const isValidEmail = (value) => {
    let reg = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    let regOficial = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return (reg.test(value) && regOficial.test(value)) || reg.test(value);
}

/**
 * 
 * @param {string} dui in format 00000000-0
 * @returns {boolean}
 * 
 * 
 * explicacion
 * 
 * -el parametro de entrada es una cadena que debe contener 8 numero seguidos de un guion medio y un ultimo numero, en ese orden exacto.
 * 
 * -el numero que esta a la derecha del guion se conoce como digito verificador
 * -se coloca el numero sin guiones y con ceros a la izquierda
 * -deben ser 10 caracters
 * -se toman los primeros 8 caracteres (sin el digito verificador) y a cada uno se le multiplica por la posicion en la que se encuentra. Partiendo que la posicion 9 es el primer numero de la izquierda.
 * -se suman todos los resultados
 * -se hace un mod de la suma dividido por 10 (osea toma el remanente de esa division)
 * -Resta 10 menos el remanente de la division
 * -si la resta da 0 el DUI es correcto
 * -si la resta es igual al digito verificador el DUI es correcto
 * -si la resta es distinta al digito verificador el DUI es incorrecto
 * 
 * 
 */
const verify_DUI = (dui) => {
    var regex = /^\d{8}-\d$/;
    if (regex.test(dui)) {
        let sum = 0;
        for (var i = 0; i < 8; i++) {
            sum += (9 - i) * parseInt(dui[i], 10);
        }
        return parseInt(dui[9]) === 10 - (sum % 10);
    }
    return false;
}

const verify_NRC = (nrc) => {
    let regex = /^\d{1,6}-\d$/;
    return regex.test(nrc);
}

const isInPage = node => node === document.body ? false : document.body.contains(node);

/*App Helpers*/
const copiarAlPortapapeles = text => {
    // Crea un campo de texto "oculto"
    var aux = document.createElement("input");
    // Asigna el contenido del elemento especificado al valor del campo
    aux.setAttribute("value", text);
    // Añade el campo a la página
    document.body.appendChild(aux);
    // Selecciona el contenido del campo
    aux.select();
    // Copia el texto seleccionado
    document.execCommand("copy");
    // Elimina el campo de la página
    document.body.removeChild(aux);
    return true;
}

const copyToClipboard = text => copiarAlPortapapeles(text);

/**get HTML from Quill editor */
const quillGetHTML = (inputDelta) => {
    var tempCont = document.createElement("div");
    (new Quill(tempCont)).setContents(inputDelta);
    return tempCont.getElementsByClassName("ql-editor")[0].innerHTML;
}


/**Function for cropper js */


const generatePreviewCropZone = (src, previewContainer, ratio = 1 / 1, result) => {
    previewContainer.innerHTML = "";
    var filePreview = document.createElement('img');
    filePreview.id = 'modal-add-image-origin-image';
    /*filePreview.className += "img img-responsive";*/
    filePreview.style.width = '100%';
    filePreview.style.maxHeight = '40vh';
    filePreview.src = src;
    previewContainer.appendChild(filePreview);
    addingImageCroppNow(filePreview, ratio, result);
}

function modalAddImageprocessSRC(url, previewimagezone, ratio, result) {
    if (isUrl(url)) {
        fetch(`/utils/image_from_url?link=${encodeURIComponent(url)}`)
            .then(response => response.text())
            .then(data => {
                generatePreviewCropZone(data, previewimagezone, ratio, result)

                document.getElementById("add-image-fake_text").value = "...paste here...";
                document.getElementById("add-image-fake_text").focus();
            }).catch(error => console.error('Error:', error));
        return true;
    } else {
        document.getElementById("add-image-fake_text").value = "...paste here...";
        errorMessage('No se ha podido procesar, asegurece que lo que ha pegado es una imagen o una Url valida');
        document.getElementById("add-image-fake_text").focus();
        return false;
    }
}

const captureImagePasted = (element, previewimagezone, ratio, result) => {
    element.addEventListener("paste", function (e) {
        for (var i = 0; i < 1; i++) {
            var clipboardItem = e.clipboardData.items[0];
            var type = clipboardItem.type;
            // verifico si es una imagen
            if (type.indexOf("image") != -1) {

                /*Creando convirtiendo la imagen pegada a un archivo BLOB*/
                var blob = clipboardItem.getAsFile();
                var blobUrl = URL.createObjectURL(blob);
                /*Creamos la imagen para la previzualizacion del Archivo subido*/
                generatePreviewCropZone(blobUrl, previewimagezone, ratio, result);

            } else if (type.indexOf("text/html") != -1) {

                var paste = (e.clipboardData || window.clipboardData).getData('text/html');
                if (paste.includes('blob:')) {
                    return errorMessage('Sorry, Blob URL is not supported', 'en');
                }
                else if (paste.indexOf("<img") != -1 && paste.indexOf("src=") != -1) {
                    try {
                        var div = document.createElement("div");
                        div.innerHTML = paste;
                        url = div.getElementsByTagName("img")[0].src;
                        if (url.indexOf(_baseURL) != -1) {
                            generatePreviewCropZone(url, previewimagezone, ratio, result);
                        } else {
                            modalAddImageprocessSRC(url, previewimagezone, ratio, result);
                        }

                    }
                    catch (e) {
                        // sentencias para manejar cualquier excepción
                        errorMessage(e); // pasa el objeto de la excepción al manejador de errores
                    }
                } else {
                    return errorMessage('no contiene ninguna imagen');
                }
            } else {

                clipboardData = e.clipboardData || window.clipboardData;
                paste = clipboardData.getData('Text');
                if (paste.includes('blob:')) {
                    return errorMessage('Sorry, Blob URL is not supported', 'en');
                } else if (paste.indexOf(_baseURL) != -1 || paste.includes('data:image/jpg;base64,') || paste.includes('data:image/jpeg;base64,')) {
                    generatePreviewCropZone(paste, previewimagezone, result);
                } else if (paste.indexOf(".jpg") != -1 || paste.indexOf(".png") != -1 || paste.indexOf(".svg") != -1 || paste.indexOf(".gif") != -1 || paste.indexOf(".ico") != -1 || paste.indexOf(".bmp") != -1) {
                    try {
                        modalAddImageprocessSRC(paste, previewimagezone, ratio, result);
                    }
                    catch (e) {
                        // sentencias para manejar cualquier excepción
                        return errorMessage(e); // pasa el objeto de la excepción al manejador de errores
                    }
                } else {
                    return errorMessage('no contiene ninguna imagen');
                }
            }

        }
    });
}

const addingImageValidateImage = (obj) => {
    var uploadFile = obj.files[0];
    if (!window.FileReader) {
        return errorMessage('El navegador no soporta la lectura de archivos');
    }
    if (!(/\.(jpg|png|gif|jpeg|webp|jfif|svg|apng|bmp|ico)$/i).test(uploadFile.name)) {
        obj.value = '';
        return false;
    }
    return true;
}

const AddingImageChargeFromFile = (input, container, rt, result) => {
    container.innerHTML = "";
    if (input.files && input.files[0]) {
        var reader = new FileReader();

        reader.onload = function (e) {
            generatePreviewCropZone(e.target.result, container, rt, result);

        }
        reader.readAsDataURL(input.files[0]);
    }
}

const addingImageCroppNow = (filePreview, ratio = null, result) => {
    var cropper = new Cropper(filePreview, {
        autoCropArea: 1,
        aspectRatio: ratio ? ratio : 1 / 1,
        crop(event) {
            var canvas = cropper.getCroppedCanvas({ fillColor: ' #fff ', });
            var base64 = canvas.toDataURL("image/jpeg");
            result.value = base64;
        },
    });
}

const genStr = (long) => {
    let result = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < long; i++) {
        const index = Math.floor(Math.random() * chars.length);
        result += chars.charAt(index);
    }
    return result;
}

const genStrLong = (minLong, maxLong) => {
    let long = Math.floor(Math.random() * (maxLong - minLong + 1)) + minLong;
    return genStr(long);
}

const copy = (text) => {
    copyToClipboard(text);
    createToast('purple', 'Codigo Copíado', 'es');
}


const toast = (color, text) => {
    createToast(color, text, 'es');
}

//manejo de monedas

var Money = {
    strlen: (string) => {
        let str = string + '';
        let i = 0, chr = '', lgth = 0;
        let getWholeChar = function (str, i) {
            let code = str.charCodeAt(i);
            let next = '', prev = '';
            if (0xD800 <= code && code <= 0xDBFF) {
                /* High surrogate (could change last hex to 0xDB7F to treat high private surrogates as single characters)*/
                if (str.length <= (i + 1)) {
                    throw 'High surrogate without following low surrogate';
                }
                next = str.charCodeAt(i + 1);
                if (0xDC00 > next || next > 0xDFFF) {
                    throw 'High surrogate without following low surrogate';
                }
                return str.charAt(i) + str.charAt(i + 1);
            } else if (0xDC00 <= code && code <= 0xDFFF) {
                /* Low surrogate */
                if (i === 0) {
                    throw 'Low surrogate without preceding high surrogate';
                }
                prev = str.charCodeAt(i - 1);
                if (0xD800 > prev || prev > 0xDBFF) {
                    /*(could change last hex to 0xDB7F to treat high private surrogates as single characters)*/
                    throw 'Low surrogate without preceding high surrogate';
                }
                return false;
                /* We can pass over low surrogates now as the second component in a pair which we have already processed */
            }
            return str.charAt(i);
        };
        for (i = 0, lgth = 0; i < str.length; i++) {
            if ((chr = getWholeChar(str, i)) === false) {
                continue;
            }
            lgth++;
        }
        return lgth;
    },

    basic: (n) => {
        let val = ["un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciseis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiun", "veintidos", "veintitres", "veinticuatro", "veinticinco", "veintiseis", "veintisiete", "veintiocho", "veintinueve"];
        return val[n - 1];
    },

    tens: (n) => {
        let val = {
            10: "diez",
            20: "veinte",
            30: "treinta",
            40: "cuarenta",
            50: "cincuenta",
            60: "sesenta",
            70: "setenta",
            80: "ochenta",
            90: "noventa"
        };

        if (n < 30) {
            return this.basic(n);
        }
        /*Si es una decena exacta*/

        let x = n % 10;
        if (x == 0) { return val[n]; }
        /*Si no es una decena exacta*/
        let decena = n - x;
        return val[decena] + ' y ' + this.basic(x);
    },

    hundreds: (n) => {
        let val = {
            100: "ciento",
            200: "doscientos",
            300: "trescientos",
            400: "cuatrocientos",
            500: "quinientos",
            600: "seiscientos",
            700: "setecientos",
            800: "ochocientos",
            900: "novecientos"
        };
        if (n === 100) {
            return "cien";
        } else if (n > 100) {
            let decenas = n % 100;
            if (decenas === 0) {
                return val[n - decenas];
            } else {
                return val[n - decenas] + " " + this.tens(decenas);
            }
        } else {
            return this.tens(n);
        }
    },

    thousands: (n) => {
        if (n > 999) {
            if (n === 1000) {
                return 'mil';
            }
            let cadena = "";
            /*Obtener el largo*/
            let l = this.strlen(n);
            /*Obtener las centenas de millar*/
            let temp = "" + n;
            let c = Number.parseInt(temp.substr(0, l - 3));
            /*obtener las centenas*/
            let x = Number.parseInt(temp.substr(-3));
            if (c == 1) {
                cadena = 'mil ' + this.hundreds(x);
            } else if (x != 0) {
                cadena = this.hundreds(c) + ' mil ' + this.hundreds(x);
            } else {
                cadena = this.hundreds(c) + ' mil';
            }
            return cadena;
        }
        return this.hundreds(n);
    },

    millions: (n) => {
        if (n === 1000000) { return 'un millón'; }
        if (n <= 999999999999) {
            var cadena = "";
            /*//sI ES DIFERENTE DE EXACTAMENTE UN MILLON
            //obtener el largo*/
            var lg = this.strlen(n);
            /*//separar milles de millones*/
            var c = Number.parseInt(n.toString().substr(0, lg - 6));
            /*separar miles*/
            var x = Number.parseInt(n.toString().substr(-6));
            if (c == 1) { cadena = ' millón '; } else { cadena = ' millones '; }
            cadena = this.thousands(c) + cadena;
            if (x > 0) { cadena = cadena + this.thousands(x); }
            return cadena;
        }
        return this.thousands(n);
    },

    money_to_string: (n, plural_currency = "Dolares", singular_currency = "Dolar") => {
        if (n > 999999999999.99) { return "not suported"; }
        else if (n === 1) { return "Un " + singular_currency; }
        else {
            /*strig to return value */
            let string = "";
            /*truncate value to two decimals */
            n = parseFloat(Math.round(n * 100) / 100).toFixed(2);
            let value = n.toString().split(".");
            /*int val to convert to string */
            let integer = Number.parseInt(value[0]);
            /* centimos */
            let cent = value[1];

            switch (true) {
                case (integer >= 1 && integer <= 29):
                    string = this.basic(integer);
                    break;
                case (integer >= 30 && integer < 100):
                    string = this.tens(integer);
                    break;
                case (integer >= 100 && integer < 1000):
                    string = this.hundreds(integer);
                    break;
                case (integer >= 1000 && integer <= 999999):
                    string = this.thousands(integer);
                    break;
                case (integer >= 1000000):
                    string = this.millions(integer);
                    break;
            }
            if (cent !== 0) {
                return string + " " + cent + "/100 " + plural_currency;
            }
            return string + " " + plural_currency;
        }
    },

    money_format: (n) => {
        return new Intl.NumberFormat('es-SV', { style: "decimal", currency: "USD", minimumFractionDigits: 2 }).format(n);
    },
};

const money_format = (n) => {
    return new Intl.NumberFormat('es-SV', { style: "decimal", currency: "USD", minimumFractionDigits: 2 }).format(n);
};



const format_date = (date, time = true) => {
    date = new Date(date);
    let day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate();
    let month = date.getMonth() + 1;
    month = month < 10 ? `0${month}` : month;
    if (time) {
        let hours = date.getHours();
        let am = 'AM';
        if (hours > 12) {
            hours = hours - 12;
            am = 'PM'
        }
        let minutes = date.getMinutes();
        minutes = minutes < 10 ? `0${minutes}` : minutes;
        return `${day}/${month}/${date.getFullYear()} ${hours}:${minutes} ${am}`;

    }
    return `${day}/${month}/${date.getFullYear()}`;

}

function date_to_spanish(date) {
    let days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    let months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Noviembre', 'Diciembre'];
    date = new Date(date);

    return days[date.getDay()] + ' ' + date.getDate() + ' de ' + months[date.getMonth()] + ' de ' + date.getFullYear();
}

/**
 * Ajuste decimal de un número.
 *
 * @param {String}  tipo  El tipo de ajuste.
 * @param {Number}  valor El numero.
 * @param {Integer} exp   El exponente (el logaritmo 10 del ajuste base).
 * @returns {Number} El valor ajustado.
 */
function decimalAdjust(type, value, exp) {
    // Si el exp no está definido o es cero...
    if (typeof exp === 'undefined' || +exp === 0) {
        return Math[type](value);
    }
    value = +value;
    exp = +exp;
    // Si el valor no es un número o el exp no es un entero...
    if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
        return NaN;
    }
    // Shift
    value = value.toString().split('e');
    value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
    // Shift back
    value = value.toString().split('e');
    return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
}

// Decimal round
if (!Math.round10) {
    Math.round10 = function (value, exp) {
        return decimalAdjust('round', value, exp);
    };
}
// Decimal floor
if (!Math.floor10) {
    Math.floor10 = function (value, exp) {
        return decimalAdjust('floor', value, exp);
    };
}
// Decimal ceil
if (!Math.ceil10) {
    Math.ceil10 = function (value, exp) {
        return decimalAdjust('ceil', value, exp);
    };
}