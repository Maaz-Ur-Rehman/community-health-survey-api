class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details) {
        super(message)
        this.name = this.constructor.name
        this.statusCode = statusCode
        this.code = code
        this.details = details
    }
}

class BadRequestError extends AppError {
    constructor(message = 'Bad request', details) {
        super(message, 400, 'BAD_REQUEST', details)
    }
}
class UnauthorizedError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'UNAUTHORIZED')
    }
}
class ForbiddenError extends AppError {
    constructor(message = 'You do not have permission to do this') {
        super(message, 403, 'FORBIDDEN')
    }
}
class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, 'NOT_FOUND')
    }
}
class ConflictError extends AppError {
    constructor(message = 'Conflict', details) {
        super(message, 409, 'CONFLICT', details)
    }
}

module.exports = {
    AppError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
}
