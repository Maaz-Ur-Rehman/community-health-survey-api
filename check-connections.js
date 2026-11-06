/* eslint-disable no-console */
// Run: node --env-file=.env check-connections.js
// Prints plain results for Node, .env, PostgreSQL and Redis.
const withTimeout = (p, ms) =>
    Promise.race([
        p,
        new Promise((_, rej) =>
            setTimeout(() => rej(new Error('timed out')), ms),
        ),
    ])

async function main() {
    console.log('Node version :', process.version)
    const env = require('./src/config/env')
    console.log('NODE_ENV     :', env.NODE_ENV, '| PORT:', env.PORT)
    console.log(
        'DATABASE_URL :',
        env.DATABASE_URL.replace(/:\/\/.*@/, '://***@'),
    )
    console.log('REDIS_URL    :', env.REDIS_URL.replace(/:\/\/.*@/, '://***@'))

    const sequelize = require('./src/config/database')
    try {
        await withTimeout(sequelize.authenticate(), 8000)
        console.log('PostgreSQL   : OK')
    } catch (e) {
        console.log('PostgreSQL   : FAILED -', e.message)
    }

    const redis = require('./src/config/redis')
    try {
        console.log('Redis        : OK', await withTimeout(redis.ping(), 8000))
    } catch (e) {
        console.log('Redis        : FAILED -', e.message)
    }
    process.exit(0)
}

main().catch((e) => {
    console.log('CHECK FAILED:', e.stack || e)
    process.exit(1)
})
