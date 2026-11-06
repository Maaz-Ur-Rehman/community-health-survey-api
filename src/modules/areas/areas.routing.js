const { Router } = require('express')
const validate = require('../../common/middleware/validate')
const authenticate = require('../../common/middleware/authenticate')
const authorize = require('../../common/middleware/authorize')
const { createAreaSchema } = require('./areas.schema')
const { list } = require('./list.action')
const { create } = require('./create.action')
const { me } = require('./me.action')

const router = Router()

router.use(authenticate)

// field worker: the area I am assigned to
router.get('/me', authorize('FIELD_WORKER'), me)

// admin only
router.get('/', authorize('SUPER_ADMIN'), list)
router.post('/', authorize('SUPER_ADMIN'), validate(createAreaSchema), create)

module.exports = router
