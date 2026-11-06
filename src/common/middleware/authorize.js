const { ForbiddenError, UnauthorizedError } = require('../errors/AppError')

// Usage: router.post('/', authorize('SUPER_ADMIN'), ...)
// Must run after authenticate. Enforced on the server, never only in the UI.
module.exports =
    (...roles) =>
    (req, res, next) => {
        if (!req.user) throw new UnauthorizedError()
        if (!roles.includes(req.user.role)) throw new ForbiddenError()
        next()
    }
