const express = require('express');
const cors = require('cors')
const path = require('path');
require('dotenv').config();
const sequelize = require("./app/DataBase/DataBase");


const app = express();
const corsOptions = {
    origin: ['https://riverasgroup.com','https://serviciosrivera.com','http://localhost:8000','http://localhost:8080'],
    optionsSuccessStatus: 200,
  };


app.use(express.urlencoded({ extended: false, limit: '150mb' }));
app.use(express.json({ limit: '150mb' }));
app.use(express.static('public', { etag: true, maxAge: 86400000 * 30 }));
app.use(cors(corsOptions));

app.locals.baseURL = `${process.env.URL_HOST}:${process.env.API_PORT}`;

app.use("/api/v1",  require('./app/ApiRoutes'));


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

const port = process.env.API_PORT || 3000;
const http = require('http');
const server = http.createServer(app);
server.listen(port, console.log(`the app is served in http://localhost:${port}`));