const crypto = require('node:crypto')
const jwt = require('jsonwebtoken')
const env = require('../../config/env')

// Access token: short-lived, stateless JWT.
function signAccessToken(user) {
    return jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
        algorithm: 'HS256',
        subject: String(user.id),
        expiresIn: env.JWT_ACCESS_TTL,
    })
}

function verifyAccessToken(token) {
    // pin the algorithm so a forged "alg: none" token is never accepted
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] })
}

// Refresh token: random opaque string. Only its SHA-256 hash is stored,
// so a database leak does not leak usable tokens.
function generateRefreshToken() {
    return crypto.randomBytes(48).toString('base64url')
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

module.exports = {
    signAccessToken,
    verifyAccessToken,
    generateRefreshToken,
    hashToken,
}
