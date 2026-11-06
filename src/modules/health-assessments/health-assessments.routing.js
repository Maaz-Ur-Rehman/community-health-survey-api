
const { Router } = require('express')

const authenticate = require('../../common/middleware/authenticate')
const authorize = require('../../common/middleware/authorize')
const validate = require('../../common/middleware/validate')

const {
    createAssessmentSchema,
    listAssessmentsSchema,
    assessmentIdSchema,
    updateAssessmentSchema,
    deleteAssessmentSchema,
} = require('./health-assessments.schema')

const { create } = require('./create.action')
const { list } = require('./list.action')
const { details } = require('./details.action')
const { update } = require('./update.action')
const { remove } = require('./delete.action')

const router = Router()

router.use(authenticate)

router.use(authorize('SUPER_ADMIN', 'FIELD_WORKER'))

router.post(
    '/',
    validate(createAssessmentSchema),
    create,
)

router.get(
    '/',
    validate(listAssessmentsSchema, 'query'),
    list,
)

router.get(
    '/:id',
    validate(assessmentIdSchema, 'params'),
    details,
)

router.patch(
    '/:id',
    validate(assessmentIdSchema, 'params'),
    validate(updateAssessmentSchema),
    update,
)

router.delete(
    '/:id',
    validate(assessmentIdSchema, 'params'),
    validate(deleteAssessmentSchema),
    remove,
)

module.exports = router
