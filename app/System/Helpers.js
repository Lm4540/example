const crypto = require('crypto');

const Helper = {
    verify_DUI: (dui) => {
        var regex = /^\d{8}-\d$/;
        if (regex.test(dui)) {
            let sum = 0;
            for (var i = 0; i < 8; i++) {
                sum += (9 - i) * parseInt(dui[i], 10);
            }
            return parseInt(dui[9]) === 10 - (sum % 10);
        }
        return false;
    },
    randomString: (len = 10) => crypto.randomBytes(len).toString('hex'),

    verify_NRC: (nrc) => {
        let regex = /^\d{1,6}-\d$/;
        return regex.test(nrc);
    },
    isValidEmail: (value) => {
        let reg = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        let regOficial = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return (reg.test(value) && regOficial.test(value)) || reg.test(value);
    },

    generateNameForUploadedFile: (len = 10) => {
        let now = new Date();
        return `${crypto.randomBytes(len).toString('hex')} ${now.getFullYear()}_${(now.getMonth() + 1).toString().padStart(2, '0')}_${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')} ${now.getMinutes().toString().padStart(2, '0')} ${now.getSeconds().toString().padStart(2, '0')}`;
    },
    money_format: (n) => {
        return new Intl.NumberFormat('es-SV', { style: "decimal", currency: "USD", minimumFractionDigits: 2 }).format(n);
    },
    format_date: (_date, time = true) => {
        let date = new Date(_date);
        // let date = new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(),  fecha.getUTCHours(), fecha.getUTCMinutes(), fecha.getUTCSeconds());
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

    },

    date_to_input: (date = null) => {
        date = date ? new Date(date) : new Date();
        let m = date.getMonth() > 8 ? date.getMonth() + 1 : `0${date.getMonth() + 1}`;
        let d = date.getDate();
        d = d > 9 ? d : `0${d}`;
        return `${date.getFullYear()}-${m}-${d}`;
    },
    date_to_spanish: (date) => {
        let days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        let months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre','Noviembre', 'Diciembre'];
        date = new Date(date);

        return days[date.getDay()] + ' ' + date.getDate() + ' de ' + months[date.getMonth()] + ' de ' + date.getFullYear();
    },
    notFound: (req, res, aditional = 'Not Found!') => {
        return req.method === "GET" ? res.status(404).render('Common/404', { aditional }) : res.status(404).json({ response: aditional });
    },
    cleanNumber: a => a.replaceAll(' ', '').replaceAll('+', '').replaceAll('-', ''),


};


module.exports = Helper;