const pino = require('pino')
const env = require('../../config/env')

const options = { level: env.NODE_ENV === 'test' ? 'silent' : 'info' }

// In development, pretty-print through a SYNCHRONOUS stream. The async
// "transport" option runs in a worker thread, and its last messages can be
// lost when the process calls process.exit() after a startup failure.
let logger
if (env.NODE_ENV === 'development') {
    const pretty = require('pino-pretty')
    logger = pino(options, pretty({ colorize: true, sync: true }))
} else {
    logger = pino(options)
}

module.exports = logger
