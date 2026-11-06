
const { Router } = require('express')

const authenticate = require('../../common/middleware/authenticate')
const authorize = require('../../common/middleware/authorize')
const validate = require('../../common/middleware/validate')

const {
    createHouseholdSchema,
    listHouseholdsSchema,
    householdIdSchema,
    updateHouseholdSchema,
    deleteHouseholdSchema,
} = require('./households.schema')

const { create } = require('./create.action')
const { list } = require('./list.action')
const { details } = require('./details.action')
const { update } = require('./update.action')
const { remove } = require('./delete.action')

const router = Router()

router.use(authenticate)

// Both roles can access households.
// Their actual access is restricted in the service layer.
router.use(authorize('SUPER_ADMIN', 'FIELD_WORKER'))

router.post(
    '/',
    validate(createHouseholdSchema),
    create,
)

router.get(
    '/',
    validate(listHouseholdsSchema, 'query'),
    list,
)

router.get(
    '/:id',
    validate(householdIdSchema, 'params'),
    details,
)

router.patch(
    '/:id',
    validate(householdIdSchema, 'params'),
    validate(updateHouseholdSchema),
    update,
)

router.delete(
    '/:id',
    validate(householdIdSchema, 'params'),
    validate(deleteHouseholdSchema),
    remove,
)

module.exports = router
