const Sequelize = require("sequelize");


const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: process.env.DB_DRIVER,/* one of 'mysql' | 'postgres' | 'sqlite' | 'mariadb' | 'mssql' | 'db2' | 'snowflake' | 'oracle' */
        dialectOptions: {
            charset: process.env.DB_CHARSET,

        },
        define: {
            charset: 'utf8mb4',
            collate: 'utf8mb4_spanish_ci',
            timestamps: true
        },
    }
);

module.exports = sequelize;