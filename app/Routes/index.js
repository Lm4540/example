const router = require('express').Router();
const fs = require('fs');
const pathRouter = `${__dirname}`;

fs.readdirSync(pathRouter).filter(file => {
    const fileWithOutExtension = file.split('.').shift();
    const exclude = ['index'].includes(fileWithOutExtension);
    if (!exclude) {
        router.use(`/${fileWithOutExtension}`, require(`./${fileWithOutExtension}`));
    }
})

// router.all('*', (req, res, next) => {
    
//     return req.method === "GET" 
//     ? res.status(404).render('Common/404', { aditional: 'Route or Resource not Found' }) 
//     : res.status(404).json({response: 'Not Found'});
// });

module.exports = router;