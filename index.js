const express = require('express');
const path = require('path');
require('dotenv').config();
const sequelize = require("./app/DataBase/DataBase");
const session = require("./app/System/Session");
const Helper = require('./app/System/Helpers');
const Auth = require('./app/System/Middleware/Auth');
const Cleaner = require('./app/System/Middleware/Cleaner');

const app = express();

app.use(session);
// app.use(cors);
app.set('views', path.join(__dirname, 'app', 'views'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false, limit: '150mb' }));
app.use(express.json({ limit: '150mb' }));
app.use(express.static('public', { etag: true, maxAge: 86400000 * 30 }));

app.locals.baseURL = `${process.env.URL_HOST}:${process.env.DEFAULT_PORT}`;

app.use((req, res, next) => {

    if(req.headers['x-forwarded-proto'] == 'https'){
        const host = req.headers['x-forwarded-host'] || req.hostname;
        res.locals.baseUrl =  `https://${host}` ;

    }
    
   return next();
});
app.locals.pageTitle = 'Riveras Group';
app.locals.options = '';
app.locals.Helper = Helper;

app.post('/login', Auth.Login);
app.get('/loginValidate', Auth.Authenticated, Auth.setUserSessionRegister);
app.get('/logout', Auth.LogOut);
app.get('/', Auth.Authenticated, async (req, res) => {
    // // console.log(req.session.id)
    // try {
    //     const Sale = require('./app/CRM/Models/Sale');
    //     const SaleDetail = require('./app/CRM/Models/SaleDetail');
    //     // await sequelize.sync({ force: false });
    // } catch (error) {
    //     console.error('Unable to connect to the database:', error);
    // }
    res.render('master', { pageTitle: 'Dashboard' })
});

app.use(Cleaner.clean);
app.use(Auth.Authenticated, require('./app/Routes'));

app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) {
        return next(err)
    } else {
        let stack = process.env.NODE_ENV == 'production' ? 'Not displayed' : err.stack;
        return req.method != 'GET'
            ? res.status(500).json({
                error: err.message,
                errno: err.errno,
                code: err.code,
                stack
            })
            : res.status(500).render('Common/500', { err, stack });
    }
})

const port = process.env.DEFAULT_PORT || 3000;

/**Socket IO Server */
const http = require('http');

const server = http.createServer(app);

//Iniciar el servidor de Websockets
require('./app/WebSockets/Sockets')(server, session);
//Iniciar el Servidor HTTP
server.listen(port, console.log(`the app is served in http://localhost:${port}`));