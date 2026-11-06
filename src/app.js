const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const pinoHttp = require('pino-http')

const env = require('./config/env')
const logger = require('./common/utils/logger')
const sequelize = require('./config/database')
const redis = require('./config/redis')
const routes = require('./routes')
const { notFound, errorHandler } = require('./common/middleware/errorHandler')

const app = express()

app.use(helmet())
app.use(cors({ origin: env.corsOrigins }))
app.use(express.json({ limit: '1mb' }))
app.use(pinoHttp({ logger }))

app.get('/health', async (req, res) => {
    const checks = { database: 'down', redis: 'down' }
    try {
        await sequelize.authenticate()
        checks.database = 'up'
    } catch {
        // reported in the response below
    }
    try {
        checks.redis = (await redis.ping()) === 'PONG' ? 'up' : 'down'
    } catch {
        // reported in the response below
    }
    const ok = Object.values(checks).every((v) => v === 'up')
    res.status(ok ? 200 : 503).json({
        status: ok ? 'ok' : 'degraded',
        checks,
    })
})

app.use('/api/v1', routes)

app.use(notFound)
app.use(errorHandler)

module.exports = app
