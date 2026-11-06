const { Router } = require('express')

const authenticate = require('../../common/middleware/authenticate')
const authorize = require('../../common/middleware/authorize')
const validate = require('../../common/middleware/validate')

const {
    createWorkerSchema,
    listWorkersSchema,
    userIdSchema,
    updateWorkerSchema,
    workerStatusSchema,
    assignAreaSchema,
} = require('./users.schema')

const { create } = require('./create.action')
const { list } = require('./list.action')
const { details } = require('./details.action')
const { update } = require('./update.action')
const { updateStatus } = require('./update-status.action')
const { assignArea } = require('./assign-area.action')

const router = Router()

// All user management endpoints are Super Admin only.
router.use(authenticate, authorize('SUPER_ADMIN'))

router.post(
    '/',
    validate(createWorkerSchema),
    create,
)

router.get(
    '/',
    validate(listWorkersSchema, 'query'),
    list,
)

router.get(
    '/:id',
    validate(userIdSchema, 'params'),
    details,
)

router.patch(
    '/:id',
    validate(userIdSchema, 'params'),
    validate(updateWorkerSchema),
    update,
)

router.patch(
    '/:id/status',
    validate(userIdSchema, 'params'),
    validate(workerStatusSchema),
    updateStatus,
)

router.patch(
    '/:id/area',
    validate(userIdSchema, 'params'),
    validate(assignAreaSchema),
    assignArea,
)

module.exports = router