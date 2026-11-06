const { Router } = require('express')

const router = Router()
// Auth Modules 
router.use('/auth', require('./modules/auth/auth.routing'))
// Areas Modules
router.use('/areas', require('./modules/areas/areas.routing'))
// Users Modules
router.use('/users', require('./modules/users/users.routing'))
// Households Modules
router.use('/households', require('./modules/households/households.routing'))
// Household Members Modules
router.use(
    '/household-members',
    require('./modules/household-members/household-members.routing'),
)
// Health Assessments Modules
router.use(
    '/health-assessments',
    require('./modules/health-assessments/health-assessments.routing'),
)
// Synchronization Modules
router.use(
    '/sync',
    require('./modules/synchronization/synchronization.routing'),
)

// Notifications Modules
router.use(
    '/notifications',
    require('./modules/notifications/notifications.routing'),
)
module.exports = router
