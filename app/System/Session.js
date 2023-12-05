const session = require('express-session');
const MySqlSessionStore = require('express-mysql-session')(session);
const { v4: uuidv4 } = require('uuid');

const SessionStoreOptions = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: process.env.DB_COLLATION,
    clearExpired: true,
    checkExpirationInterval: 3600000 * 24,
    schema: {
        tableName: 'system_sessions',
        columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data'
        }
    }
}
const sessionStore = new MySqlSessionStore(SessionStoreOptions);

module.exports = session({
    key: process.env.COKIE_NAME,
    secret: 'Riveras_Cookie',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    genid: function(req) {
        return uuidv4(); // use UUIDs for session IDs
    },
});