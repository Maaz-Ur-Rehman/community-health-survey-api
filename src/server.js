const app = require('./app')
const env = require('./config/env')
const logger = require('./common/utils/logger')
const sequelize = require('./config/database')
const redis = require('./config/redis')

// Fatal errors use console on purpose: this must print even if the logger
// itself is the thing that is broken.
function fatal(message, err) {
    // eslint-disable-next-line no-console
    console.error(`\n[FATAL] ${message}\n`, err && err.stack ? err.stack : err)
    process.exit(1)
}

process.on('uncaughtException', (err) => fatal('Uncaught exception', err))
process.on('unhandledRejection', (err) => fatal('Unhandled rejection', err))

function withTimeout(promise, ms, message) {
    let timer
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function start() {
    await withTimeout(
        sequelize.authenticate(),
        8000,
        'PostgreSQL connection timed out - is the PostgreSQL service running?',
    )
    logger.info('PostgreSQL connected')

    await withTimeout(
        redis.ping(),
        8000,
        'Redis connection timed out - check REDIS_URL in .env',
    )
    logger.info('Redis connected')

    const server = app.listen(env.PORT, () => {
        logger.info(`API listening on http://localhost:${env.PORT}`)
    })

    const shutdown = (signal) => {
        logger.info(`${signal} received, shutting down`)
        server.close(async () => {
            await sequelize.close()
            redis.disconnect()
            process.exit(0)
        })
    }
    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
}

start().catch((err) => fatal('Failed to start server', err))
