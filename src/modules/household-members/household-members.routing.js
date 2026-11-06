
const { Router } = require('express')

const authenticate = require('../../common/middleware/authenticate')
const authorize = require('../../common/middleware/authorize')
const validate = require('../../common/middleware/validate')

const {
    createMemberSchema,
    listMembersSchema,
    memberIdSchema,
    updateMemberSchema,
    deleteMemberSchema,
} = require('./household-members.schema')

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
    validate(createMemberSchema),
    create,
)

router.get(
    '/',
    validate(listMembersSchema, 'query'),
    list,
)

router.get(
    '/:id',
    validate(memberIdSchema, 'params'),
    details,
)

router.patch(
    '/:id',
    validate(memberIdSchema, 'params'),
    validate(updateMemberSchema),
    update,
)

router.delete(
    '/:id',
    validate(memberIdSchema, 'params'),
    validate(deleteMemberSchema),
    remove,
)

module.exports = router
