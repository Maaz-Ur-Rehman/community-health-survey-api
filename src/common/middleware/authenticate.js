const { User } = require('../../database/models')
const { UnauthorizedError } = require('../errors/AppError')
const { verifyAccessToken } = require('../utils/tokens')

// Verifies the Bearer token, then loads the user from the database on every
// request. The database check is what makes deactivating a field worker take
// effect immediately instead of when their access token expires.
module.exports = async function authenticate(req, res, next) {
    const header = req.get('authorization') || ''
    const [scheme, token] = header.split(' ')
    if (scheme !== 'Bearer' || !token) {
        throw new UnauthorizedError('Missing or malformed Authorization header')
    }

    let payload
    try {
        payload = verifyAccessToken(token)
    } catch {
        throw new UnauthorizedError('Invalid or expired access token')
    }

    const user = await User.findByPk(payload.sub)
    if (!user || !user.isActive) {
        throw new UnauthorizedError('Account is not active')
    }

    req.user = user
    next()
}
