const sequelize = require('../../config/database')
const Area = require('./Area')
const User = require('./User')
const RefreshToken = require('./RefreshToken')
const Household = require('./Household')
const HouseholdMember = require('./HouseholdMember')
const HealthAssessment = require('./HealthAssessment')
const ProcessedOp = require('./ProcessedOp')
const Notification = require('./Notification')

// Area 1 - N User (a worker has at most one area)
Area.hasMany(User, { foreignKey: 'areaId', as: 'workers' })
User.belongsTo(Area, { foreignKey: 'areaId', as: 'area' })

// User 1 - N RefreshToken
User.hasMany(RefreshToken, { foreignKey: 'userId', as: 'refreshTokens' })
RefreshToken.belongsTo(User, { foreignKey: 'userId', as: 'user' })

// Area 1 - N Household
Area.hasMany(Household, { foreignKey: 'areaId', as: 'households' })
Household.belongsTo(Area, { foreignKey: 'areaId', as: 'area' })

// Household 1 - N HouseholdMember
Household.hasMany(HouseholdMember, { foreignKey: 'householdId', as: 'members' })
HouseholdMember.belongsTo(Household, {
    foreignKey: 'householdId',
    as: 'household',
})

// HouseholdMember 1 - N HealthAssessment
HouseholdMember.hasMany(HealthAssessment, {
    foreignKey: 'memberId',
    as: 'assessments',
})
HealthAssessment.belongsTo(HouseholdMember, {
    foreignKey: 'memberId',
    as: 'member',
})

// HealthAssessment 1 - 1 Notification
HealthAssessment.hasOne(Notification, {
    foreignKey: 'assessmentId',
    as: 'notification',
})
Notification.belongsTo(HealthAssessment, {
    foreignKey: 'assessmentId',
    as: 'assessment',
})

// audit columns
Household.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' })
HouseholdMember.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' })
HealthAssessment.belongsTo(User, { foreignKey: 'recordedBy', as: 'recorder' })

// sync idempotency log
ProcessedOp.belongsTo(User, { foreignKey: 'userId', as: 'user' })

module.exports = {
    sequelize,
    Area,
    User,
    RefreshToken,
    Household,
    HouseholdMember,
    HealthAssessment,
    ProcessedOp,
    Notification,
}
