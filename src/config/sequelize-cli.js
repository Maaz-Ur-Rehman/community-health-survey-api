// Used only by sequelize-cli (migrate and seed commands)
const env = require('./env')

const base = {
    url: env.DATABASE_URL,
    dialect: 'postgres',
    define: { underscored: true },
}

module.exports = { development: base, test: base, production: base }
