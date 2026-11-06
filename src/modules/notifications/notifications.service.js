
const { Notification, HealthAssessment, HouseholdMember, Household, Area } =
    require('../../database/models')

const { NotFoundError } = require('../../common/errors/AppError')

// Associations used to display the assessment context.
const notificationIncludes = [
    {
        model: HealthAssessment,
        as: 'assessment',
        required: false,
        paranoid: false,
        attributes: [
            'id',
            'memberId',
            'isUrgent',
            'temperatureC',
            'hasFever',
            'hasBreathingDifficulty',
            'createdAt',
        ],
        include: [
            {
                model: HouseholdMember,
                as: 'member',
                required: false,
                paranoid: false,
                attributes: [
                    'id',
                    'name',
                    'age',
                    'gender',
                    'householdId',
                ],
                include: [
                    {
                        model: Household,
                        as: 'household',
                        required: false,
                        paranoid: false,
                        attributes: [
                            'id',
                            'householdCode',
                            'areaId',
                        ],
                        include: [
                            {
                                model: Area,
                                as: 'area',
                                attributes: ['id', 'code', 'name'],
                            },
                        ],
                    },
                ],
            },
        ],
    },
]

// Format API response.
function toPublicNotification(notification) {
    const assessment = notification.assessment
    const member = assessment?.member
    const household = member?.household

    return {
        id: notification.id,
        assessmentId: notification.assessmentId,
        type: notification.type,
        message: notification.message,
        isRead: Boolean(notification.readAt),
        readAt: notification.readAt,
        createdAt: notification.createdAt,

        assessment: assessment
            ? {
                id: assessment.id,
                isUrgent: assessment.isUrgent,
                temperatureC: assessment.temperatureC,
                hasFever: assessment.hasFever,
                hasBreathingDifficulty:
                    assessment.hasBreathingDifficulty,

                member: member
                    ? {
                        id: member.id,
                        name: member.name,
                        age: member.age,
                        gender: member.gender,
                    }
                    : null,

                household: household
                    ? {
                        id: household.id,
                        householdCode: household.householdCode,
                        area: household.area
                            ? {
                                id: household.area.id,
                                code: household.area.code,
                                name: household.area.name,
                            }
                            : null,
                    }
                    : null,
            }
            : null,
    }
}

// CREATE URGENT NOTIFICATION
// This function will be called by our BullMQ worker.
async function createUrgentNotification(assessmentId) {
    const assessment = await HealthAssessment.findByPk(
        assessmentId,
        {
            attributes: ['id', 'isUrgent'],
        },
    )

    if (!assessment || !assessment.isUrgent) {
        return null
    }

    const [notification, created] =
        await Notification.findOrCreate({
            where: {
                assessmentId,
            },

            defaults: {
                assessmentId,
                type: 'URGENT_ASSESSMENT',
                message:
                    `Urgent health assessment #${assessmentId} requires review.`,
            },
        })

    return {
        notification,
        created,
    }
}

// LIST NOTIFICATIONS
async function listNotifications(filters) {
    const {
        page,
        limit,
        unreadOnly,
    } = filters

    const where = {}

    if (unreadOnly === true) {
        where.readAt = null
    }

    const { rows, count } =
        await Notification.findAndCountAll({
            where,

            include: notificationIncludes,

            order: [
                ['createdAt', 'DESC'],
                ['id', 'DESC'],
            ],

            limit,
            offset: (page - 1) * limit,
            distinct: true,
        })

    return {
        data: rows.map(toPublicNotification),

        pagination: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
        },
    }
}

// GET UNREAD COUNT
async function getUnreadCount() {
    const count = await Notification.count({
        where: {
            readAt: null,
        },
    })

    return { unreadCount: count }
}

// MARK ONE NOTIFICATION AS READ
async function markNotificationRead(id) {
    const notification = await Notification.findByPk(id)

    if (!notification) {
        throw new NotFoundError('Notification not found')
    }

    // Idempotent operation: don't change the original read timestamp.
    if (!notification.readAt) {
        await notification.update({
            readAt: new Date(),
        })
    }

    return toPublicNotification(notification)
}

// MARK ALL NOTIFICATIONS AS READ
async function markAllNotificationsRead() {
    const readAt = new Date()

    const [updatedCount] = await Notification.update(
        { readAt },
        {
            where: {
                readAt: null,
            },
        },
    )

    return {
        updatedCount,
        readAt,
    }
}

module.exports = {
    createUrgentNotification,
    listNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
}
