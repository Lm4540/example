const axios = require('axios').default;
const UtilsController = {
    index: async (req, res) => {
        return res.render('Utils/index', {pageTitle: 'Utilidades'});
    },
    getImageFromUrl: async (req, res) => {
        try {
            let url = req.query.link;
            console.log(url);
            let image = await axios.get(url, {responseType: 'arraybuffer'});
            res.send('data:image/jpg;base64,'+ Buffer.from(image.data).toString('base64'));
            //res.send('this is a response');
        } catch (error) {
            console.log(error)
        }


        /*
        try {
            const url = req.query.url;
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            res.writeHead(200, {
                'Content-Type': 'image/jpeg',
                'Content-Length': response.data.byteLength
            });
            res.end(Buffer.from(response.data).toString('base64'));
        } catch (error) {
            console.log(error);
            res.status(404).send("This URL not contains Image or itsn't available");
        }
        */
    },

    
};

module.exports = UtilsController;