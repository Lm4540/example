const bcrypt = require("bcryptjs");

const manager = {
    saltRounds: 10,
    pass_encrypt: async (text) => {
        await bcrypt.hash(text, 10, function (err, hash) {
            console.log('hash en la funcion', hash);
            return hash;
        })
    },
    pass_check: async (userPassword, storedHash) => {
        bcrypt.compare(userPassword, storedHash, (err, result) => {
            return err ? false : result;
        });
    }
}


module.exports = manager;