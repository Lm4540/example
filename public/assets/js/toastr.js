var notifications = document.querySelector(".notifications");
if (notifications !== undefined) {
    notifications = document.createElement('ul');
    notifications.className = 'notifications';
    document.body.appendChild(notifications);
}

const say = (msg, lang = 'es-MX') => {

    try {
        if (VoiceEnabled !== undefined && VoiceEnabled === true) {
            speechSynthesis.cancel();
            let voices = speechSynthesis.getVoices();
            let _Utterance = new SpeechSynthesisUtterance();
            if (voices.length > 1) { _Utterance.voice = voices[1]; }
            //  _Utterance.pitch = .5;
            // _Utterance.lang = lang == 'es'? 'es-MX' : (lang !== null ? lang : 'es-MX');
            _Utterance.lang = lang == 'es' ? 'es-MX' : lang;
            _Utterance.text = msg;
            speechSynthesis.speak(_Utterance);
        }
    } catch (error) { console.error(error); }
};

const errorMessage = (msg, lang = 'es-MX') => {
    say(msg, lang);
    createToast('error', msg, lang);
    return false;
}

const successMessage = (msg, lang = 'es-MX') => {
    say(msg, lang);
    createToast('success', msg, lang);
    return true;
}

const warningMessage = (msg, lang = 'es-MX') => {
    say(msg, lang);
    createToast('warning', msg, lang);
    return false;
}

const infoMessage = (msg, lang = 'es-MX') => {
    say(msg, lang);
    createToast('info', msg, lang);
    return false;
}

const darkMessage = (msg, lang = 'es-MX') => {
    say(msg, lang);
    createToast('dark', msg, lang);
    return false;
}

const purpleMessage = (msg, lang = 'es-MX') => {
    say(msg, lang);
    createToast('purple', msg, lang);
    return false;
}


const blueMessage = (msg, lang = 'es-MX') => {
    say(msg, lang);
    createToast('blue', msg, lang);
    return false;
}

const roseMessage = (msg, lang = 'es-MX') => {
    say(msg, lang);
    createToast('rose', msg, lang);
    return false;
}


const toastDetails = {
    timer: 10000,
    success: {
        icon: 'fas fa-check-circle',
    },
    error: {
        icon: 'fas fa-times-circle',
    },
    warning: {
        icon: 'fas fa-exclamation-triangle',
    },
    info: {
        icon: 'far fa-info-circle',
    },
    dark: {
        icon: 'far fa-info-circle',
    },
    purple: {
        icon: 'far fa-info-circle',
    },
    blue: {
        icon: 'far fa-info-circle',
    },
    rose: {
        icon: 'far fa-info-circle',
    },
    langs: {
        'en-US': {
            error: 'Error',
            success: 'Success',
            info: 'Info',
            warning: 'Warning',
            purple: 'Info',
            blue: 'Info',
            rose: 'Info',
            dark: 'Info'
        },
        'es-MX': {
            error: 'Error',
            success: 'Exito',
            info: 'Información',
            warning: 'Advertencia',
            purple: 'Información',
            blue: 'Información',
            rose: 'Información',
            dark: 'Información',
        }
    }
}

const removeToast = (toast) => {
    toast.classList.add("hide");
    if (toast.timeoutId) clearTimeout(toast.timeoutId); // Clearing the timeout for the toast
    setTimeout(() => toast.remove(), 500); // Removing the toast after 500ms
}

const createToast = (type, text, lang = null) => {
    lang = lang == 'en' || lang == 'en-US' ? 'en-US' : 'es-MX';
    title = toastDetails.langs[lang][type];
    // Getting the icon and text for the toast based on the id passed
    const { icon } = toastDetails[type];
    const toast = document.createElement("li"); // Creating a new 'li' element for the toast
    toast.className = `toast2 ${type}`; // Setting the classes for the toast
    // Setting the inner HTML for the toast
    toast.innerHTML = `<div class="column">
                         <i class="fa-solid ${icon}"></i>
                         <span>${title}: ${text}</span>
                      </div>
                      <i class="fas fa-times" onclick="removeToast(this.parentElement)"></i>`;
    notifications.appendChild(toast); // Append the toast to the notification ul
    // Setting a timeout to remove the toast after the specified duration
    toast.timeoutId = setTimeout(() => removeToast(toast), toastDetails.timer);
}



