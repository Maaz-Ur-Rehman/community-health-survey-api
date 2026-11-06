
const { Router } = require('express')

const authenticate = require('../../common/middleware/authenticate')
const authorize = require('../../common/middleware/authorize')
const validate = require('../../common/middleware/validate')

const {
    pushSchema,
    pullSchema,
} = require('./synchronization.schema')

const { push } = require('./push.action')
const { pull } = require('./pull.action')

const router = Router()

router.use(authenticate)

// Synchronization is available to field workers only.
router.use(authorize('FIELD_WORKER'))

// Upload offline operations.
router.post(
    '/push',
    validate(pushSchema),
    push,
)

// Download server changes.
router.get(
    '/pull',
    validate(pullSchema, 'query'),
    pull,
)

module.exports = router
