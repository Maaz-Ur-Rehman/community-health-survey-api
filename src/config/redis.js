const IORedis = require('ioredis')
const env = require('./env')
const logger = require('../common/utils/logger')

// maxRetriesPerRequest must be null so BullMQ workers can use this connection
const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })

redis.on('error', (err) => logger.error({ err }, 'Redis error'))

module.exports = redis
