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

module.exports = Money;