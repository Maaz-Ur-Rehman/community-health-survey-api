const { Router } = require('express')
const { rateLimit } = require('express-rate-limit')
const env = require('../../config/env')
const validate = require('../../common/middleware/validate')
const authenticate = require('../../common/middleware/authenticate')
const { loginSchema, refreshSchema } = require('./auth.schema')
const { login } = require('./login.action')
const { refresh } = require('./refresh.action')
const { logout } = require('./logout.action')
const { me } = require('./me.action')

const router = Router()

// slows down password guessing
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    message: {
        error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many attempts, try later',
        },
    },
})

router.post('/login', loginLimiter, validate(loginSchema), login)
router.post('/refresh', validate(refreshSchema), refresh)
router.post('/logout', validate(refreshSchema), logout)
router.get('/me', authenticate, me)

module.exports = router
