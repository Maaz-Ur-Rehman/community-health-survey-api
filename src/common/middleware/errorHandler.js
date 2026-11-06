const { ZodError } = require('zod')
const { AppError, NotFoundError } = require('../errors/AppError')
const logger = require('../utils/logger')

function notFound(req, res, next) {
    next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`))
}

// Express 5 forwards rejected promises here automatically,
// so actions do not need try/catch or an asyncHandler wrapper.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (err instanceof ZodError) {
        return res.status(400).json({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                details: err.issues.map((i) => ({
                    path: i.path.join('.'),
                    message: i.message,
                })),
            },
        })
    }

    if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
            error: {
                code: 'CONFLICT',
                message: 'A record with these values already exists',
            },
        })
    }

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: {
                code: err.code,
                message: err.message,
                details: err.details,
            },
        })
    }

    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' },
        })
    }

    logger.error({ err }, 'Unhandled error')
    return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    })
}

module.exports = { notFound, errorHandler }
