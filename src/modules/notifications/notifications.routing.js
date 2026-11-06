
const { Router } = require('express')

const authenticate = require('../../common/middleware/authenticate')
const authorize = require('../../common/middleware/authorize')
const validate = require('../../common/middleware/validate')

const {
    listNotificationsSchema,
    notificationIdSchema,
} = require('./notifications.schema')

const { list } = require('./list.action')
const { unreadCount } = require('./unread-count.action')
const { markRead } = require('./mark-read.action')
const { markAllRead } = require('./mark-all-read.action')

const router = Router()

router.use(authenticate)
router.use(authorize('SUPER_ADMIN'))

router.get(
    '/',
    validate(listNotificationsSchema, 'query'),
    list,
)

router.get(
    '/unread-count',
    unreadCount,
)

// Mark all as read.
router.patch(
    '/read-all',
    markAllRead,
)

// Mark a specific notification as read.
router.patch(
    '/:id/read',
    validate(notificationIdSchema, 'params'),
    markRead,
)

module.exports = router
