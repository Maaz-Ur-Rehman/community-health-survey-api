
const { Op } = require('sequelize')

const {
    Household,
    HouseholdMember,
    HealthAssessment,
} = require('../../database/models')

const {
    BadRequestError,
    ForbiddenError,
} = require('../../common/errors/AppError')

const ENTITY_ORDER = [
    'HOUSEHOLD',
    'HOUSEHOLD_MEMBER',
    'HEALTH_ASSESSMENT',
]

function ensureAssignedArea(user) {
    if (!user.areaId) {
        throw new ForbiddenError(
            'You are not assigned to any area',
        )
    }

    return user.areaId
}

// Encode the last returned record as an opaque cursor.
function encodeCursor(change) {
    const payload = {
        updatedAt: new Date(change.updatedAt).toISOString(),
        entity: change.entity,
        id: change.serverId,
    }

    return Buffer
        .from(JSON.stringify(payload))
        .toString('base64url')
}

// Decode and validate cursor.
function decodeCursor(value) {
    if (!value) return null

    try {
        const decoded = JSON.parse(
            Buffer.from(value, 'base64url').toString('utf8'),
        )

        const date = new Date(decoded.updatedAt)
        const entity = decoded.entity
        const id = Number(decoded.id)

        if (
            Number.isNaN(date.getTime()) ||
            !ENTITY_ORDER.includes(entity) ||
            !Number.isSafeInteger(id) ||
            id <= 0
        ) {
            throw new Error('Invalid cursor')
        }

        return {
            date,
            entity,
            id,
            rank: ENTITY_ORDER.indexOf(entity),
        }
    } catch {
        throw new BadRequestError(
            'Invalid synchronization cursor',
        )
    }
}

// Build a consistent cursor filter for each table.
function getCursorWhere(entity, cursor) {
    if (!cursor) return {}

    const rank = ENTITY_ORDER.indexOf(entity)

    const conditions = [
        {
            updatedAt: {
                [Op.gt]: cursor.date,
            },
        },
    ]

    // Entities appearing after the cursor entity can have
    // the same timestamp.
    if (rank > cursor.rank) {
        conditions.push({
            updatedAt: cursor.date,
        })
    }

    // Same entity and timestamp: continue after the last ID.
    if (rank === cursor.rank) {
        conditions.push({
            updatedAt: cursor.date,
            id: { [Op.gt]: cursor.id },
        })
    }

    return {
        [Op.or]: conditions,
    }
}

function toIso(value) {
    return value ? new Date(value).toISOString() : null
}

// ---------------- FORMAT HOUSEHOLD CHANGE ----------------

function formatHouseholdChange(record) {
    return {
        entity: 'HOUSEHOLD',
        operation: record.deletedAt ? 'DELETE' : 'UPSERT',

        serverId: record.id,
        clientId: record.clientId,
        version: record.version,

        updatedAt: toIso(record.updatedAt),
        deletedAt: toIso(record.deletedAt),

        data: {
            householdCode: record.householdCode,
            areaId: record.areaId,
            address: record.address,
            latitude: record.latitude,
            longitude: record.longitude,
        },
    }
}

// ---------------- FORMAT MEMBER CHANGE ----------------

function formatMemberChange(record) {
    return {
        entity: 'HOUSEHOLD_MEMBER',
        operation: record.deletedAt ? 'DELETE' : 'UPSERT',

        serverId: record.id,
        clientId: record.clientId,
        version: record.version,

        updatedAt: toIso(record.updatedAt),
        deletedAt: toIso(record.deletedAt),

        data: {
            householdClientId: record.household.clientId,
            name: record.name,
            age: record.age,
            gender: record.gender,
            relationship: record.relationship,
        },
    }
}

// ---------------- FORMAT ASSESSMENT CHANGE ----------------

function formatAssessmentChange(record) {
    return {
        entity: 'HEALTH_ASSESSMENT',
        operation: record.deletedAt ? 'DELETE' : 'UPSERT',

        serverId: record.id,
        clientId: record.clientId,
        version: record.version,

        updatedAt: toIso(record.updatedAt),
        deletedAt: toIso(record.deletedAt),

        data: {
            memberClientId: record.member.clientId,

            temperatureC: record.temperatureC,
            hasFever: record.hasFever,
            hasCough: record.hasCough,
            hasBreathingDifficulty:
                record.hasBreathingDifficulty,

            systolic: record.systolic,
            diastolic: record.diastolic,
            notes: record.notes,

            flaggedForReview: record.flaggedForReview,
            isUrgent: record.isUrgent,

            recordedBy: record.recordedBy,
        },
    }
}

// Sort changes across different database tables.
function compareChanges(a, b) {
    const timeDifference =
        new Date(a.updatedAt).getTime() -
        new Date(b.updatedAt).getTime()

    if (timeDifference !== 0) return timeDifference

    const rankDifference =
        ENTITY_ORDER.indexOf(a.entity) -
        ENTITY_ORDER.indexOf(b.entity)

    if (rankDifference !== 0) return rankDifference

    return a.serverId - b.serverId
}

async function pullChanges(filters, user) {
    const areaId = ensureAssignedArea(user)

    const { cursor: cursorValue, limit } = filters

    const cursor = decodeCursor(cursorValue)

    // Get changed households.
    const households = await Household.findAll({
        where: {
            areaId,
            ...getCursorWhere('HOUSEHOLD', cursor),
        },

        paranoid: false,

        order: [
            ['updatedAt', 'ASC'],
            ['id', 'ASC'],
        ],

        limit: limit + 1,
    })

    // Get changed members belonging to this worker's area.
    const members = await HouseholdMember.findAll({
        where: getCursorWhere(
            'HOUSEHOLD_MEMBER',
            cursor,
        ),

        paranoid: false,

        include: [
            {
                model: Household,
                as: 'household',
                required: true,
                paranoid: false,

                where: { areaId },

                attributes: [
                    'id',
                    'clientId',
                    'areaId',
                    'deletedAt',
                ],
            },
        ],

        order: [
            ['updatedAt', 'ASC'],
            ['id', 'ASC'],
        ],

        limit: limit + 1,
    })

    // Get changed assessments belonging to this worker's area.
    const assessments = await HealthAssessment.findAll({
        where: getCursorWhere(
            'HEALTH_ASSESSMENT',
            cursor,
        ),

        paranoid: false,

        include: [
            {
                model: HouseholdMember,
                as: 'member',
                required: true,
                paranoid: false,

                attributes: [
                    'id',
                    'clientId',
                    'householdId',
                    'deletedAt',
                ],

                include: [
                    {
                        model: Household,
                        as: 'household',
                        required: true,
                        paranoid: false,

                        where: { areaId },

                        attributes: [
                            'id',
                            'clientId',
                            'areaId',
                        ],
                    },
                ],
            },
        ],

        order: [
            ['updatedAt', 'ASC'],
            ['id', 'ASC'],
        ],

        limit: limit + 1,
    })

    // Combine all entity changes into one stream.
    const changes = [
        ...households.map(formatHouseholdChange),
        ...members.map(formatMemberChange),
        ...assessments.map(formatAssessmentChange),
    ].sort(compareChanges)

    const hasMore = changes.length > limit

    // Return only the current page.
    const page = changes.slice(0, limit)

    // The last returned change becomes the next cursor.
    const lastChange = page[page.length - 1]

    const nextCursor = lastChange
        ? encodeCursor(lastChange)
        : cursorValue || null

    return {
        data: {
            changes: page,
            nextCursor,
            hasMore,
            limit,
        },
    }
}

module.exports = {
    pullChanges,
}
