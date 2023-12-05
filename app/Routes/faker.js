const router = require("express").Router();
const faker = require('faker');

const Sucursal = require('../Inventory/Models/Sucursal');
const Product = require('../Inventory/Models/Product');
const ProductClassification = require('../Inventory/Models/ProductClassification');
const Provider = require('../Inventory/Models/Provider');
const Client = require('../CRM/Models/Client');
// Home page route.

router.get('/test', async (req, res) => {
    faker.setLocale('es_MX');
   /* for (let index = 0; index < 100; index++) {
        let provider = await Provider.create({
            name: `${faker.company.companyName()} ${faker.company.companySuffix()}`,
            type: 'product',
            NIT_DUI: faker.phone.phoneNumber('########-#'),
            NRC: faker.phone.phoneNumber('########-#'),
            image: faker.image.image(500,500),
            isLocal: true,
            isRetentionAgent: false,
            classification: 'otro',
            createdBy: 'Luis Rivera',
            web: faker.internet.domainName(),
            phone: faker.phone.phoneNumber('+503-7#######'),
            email: faker.internet.email(),
            direction: faker.address.streetAddress(true)
        });
        
    }*/


})

router.get("/populate", async (req, res) => {
/*
    try {
        //Crear dos o tres sucursales


        faker.setLocale('es_MX');

        let sucursal = await Sucursal.create({
            name: 'Casa matriz',
            location: 'Edificio Carolina',
            mapLink: 'https://goo.gl/maps/ZvpYcMK6qx2bzsyU7',
            hasAreas: false,
            isWharehouse: true,
            isSalesRoom: true
        });

        sucursal = await Sucursal.create({
            name: 'Sucursal Santa Ana Centro',
            location: 'Barrio el Centro Santa Ana',
            mapLink: 'https://goo.gl/maps/ZvpYcMK6qx2bzsyU7',
            hasAreas: false,
            isWharehouse: true,
            isSalesRoom: true
        });

        sucursal = await Sucursal.create({
            name: 'Sucursal San Salvador Centro',
            location: 'Mercado Central San Salvador',
            mapLink: 'https://goo.gl/maps/ZvpYcMK6qx2bzsyU7',
            hasAreas: false,
            isWharehouse: true,
            isSalesRoom: true
        });


        //Crear 5 clasificaciones para los productos
        for (let category = 0; category < 5; category++) {
            let category = await ProductClassification.create({
                name: faker.commerce.department(),
                image: faker.image.image(500, 500),
            });

        }

        //Crear 1000 Productos ficticios con su imagen

        for (let index = 0; index < 1000; index++) {
            let price = faker.commerce.price();

            let p = await Product.create({
                name: faker.commerce.productName(),
                provider_code: faker.random.alphaNumeric(6),
                internal_code: faker.random.alphaNumeric(6),
                type: 'product',
                client_description: faker.commerce.productDescription(),
                description: faker.commerce.productDescription(),
                clasification: 1 | 2 | 3 | 4 | 5,
                provider: faker.random.number(100),
                min_stock: 0,
                max_stock: 100,
                last_out: null,
                last_in: null,
                image: faker.image.image(500, 500),
                cost: 0.00,
                last_cost: 0.00,
                base_price: price,
                major_price: Number.parseFloat(Number.parseFloat(price) + 3).toFixed(2),
                createdBy: 'Luis Rivera',
                available_for_sale: true,
            });

        }


        //Crear 100 Clientes

        for (let index = 0; index < 100; index++) {
            let client = await Client.create({
                name: faker.name.findName(),
                type: 'minor',
                NIT_DUI: faker.phone.phoneNumber('########-#'),
                NRC: faker.phone.phoneNumber('####-#'),
                isLocal: true,
                isRetentionAgent: false,
                classification: 'otro',
                createdBy: 'Luis Rivera',
                phone: faker.phone.phoneNumber('+503-7###-####'),
                email: faker.internet.email(),
                direction: faker.address.streetAddress(true),
                balance: 0.00,
            });

        }

        //Mandar un mensaje de finalizado
        console.log(faker.fake('Hi, my name is {{name.firstName}} {{name.lastName}} and my url is {{image.cats}}!'));
        return res.send(faker.image.fashion(500, 500));

    } catch (error) {
        console.log(error.messagge);
        return res.send('an Error ocurred, please check the system Console');
    }

*/
});



module.exports = router;