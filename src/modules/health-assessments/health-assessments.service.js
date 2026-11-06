
const { randomUUID } = require('node:crypto')

const {
    sequelize,
    HealthAssessment,
    HouseholdMember,
    Household,
    Area,
} = require('../../database/models')

const urgentAssessmentQueue = require('../../queues/urgent-assessment.queue')
const logger = require('../../common/utils/logger')

const {
    ConflictError,
    ForbiddenError,
    NotFoundError,
} = require('../../common/errors/AppError')

const URGENT_TEMPERATURE_C = 38

// --------------------------------------------------
// AREA ACCESS
// --------------------------------------------------

function getAreaAccessWhere(user) {
    if (user.role === 'FIELD_WORKER') {
        if (!user.areaId) {
            throw new ForbiddenError(
                'You are not assigned to any area',
            )
        }

        return { areaId: user.areaId }
    }

    return {}
}

// --------------------------------------------------
// URGENCY CALCULATION
// --------------------------------------------------

function calculateUrgency(data) {
    return (
        Number(data.temperatureC) >= URGENT_TEMPERATURE_C ||
        data.hasFever === true ||
        data.hasBreathingDifficulty === true ||
        data.flaggedForReview === true
    )
}

// --------------------------------------------------
// FIND ACCESSIBLE HOUSEHOLD MEMBER
// --------------------------------------------------

async function findAccessibleMember(memberId, user) {
    const member = await HouseholdMember.findOne({
        where: {
            id: memberId,
        },

        attributes: [
            'id',
            'clientId',
            'householdId',
            'name',
            'age',
            'gender',
            'relationship',
            'version',
        ],

        include: [
            {
                model: Household,
                as: 'household',
                required: true,

                where: getAreaAccessWhere(user),

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
    })

    if (!member) {
        throw new NotFoundError('Household member not found')
    }

    return member
}

// Lock the household and member before writing.
// This makes area reassignment and member writes serialize
// when they use compatible row locking.
async function lockAccessibleMember(memberId, user, transaction) {
    const reference = await HouseholdMember.findByPk(memberId, {
        transaction,
    })

    if (!reference) {
        throw new NotFoundError('Household member not found')
    }

    const household = await Household.findOne({
        where: {
            id: reference.householdId,
            ...getAreaAccessWhere(user),
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
    })

    if (!household) {
        throw new NotFoundError('Household member not found')
    }

    const member = await HouseholdMember.findOne({
        where: {
            id: memberId,
            householdId: household.id,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
    })

    if (!member) {
        throw new NotFoundError('Household member not found')
    }

    return { member, household }
}

// --------------------------------------------------
// FIND ACCESSIBLE ASSESSMENT
// --------------------------------------------------

async function findAccessibleAssessment(id, user) {
    const assessment = await HealthAssessment.findOne({
        where: { id },

        include: [
            {
                model: HouseholdMember,
                as: 'member',
                required: true,

                attributes: [
                    'id',
                    'clientId',
                    'name',
                    'age',
                    'gender',
                    'relationship',
                ],

                include: [
                    {
                        model: Household,
                        as: 'household',
                        required: true,

                        where: getAreaAccessWhere(user),

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
    })

    if (!assessment) {
        throw new NotFoundError('Health assessment not found')
    }

    return assessment
}

// --------------------------------------------------
// RESPONSE FORMATTER
// --------------------------------------------------

function toPublicAssessment(assessment) {
    const member = assessment.member
    const household = member?.household

    return {
        id: assessment.id,
        clientId: assessment.clientId,

        memberId: assessment.memberId,

        member: member
            ? {
                id: member.id,
                name: member.name,
                age: member.age,
                gender: member.gender,
                relationship: member.relationship,
            }
            : null,

        household: household
            ? {
                id: household.id,
                householdCode: household.householdCode,
                areaId: household.areaId,
                area: household.area
                    ? {
                        id: household.area.id,
                        code: household.area.code,
                        name: household.area.name,
                    }
                    : null,
            }
            : null,

        temperatureC: assessment.temperatureC,
        hasFever: assessment.hasFever,
        hasCough: assessment.hasCough,
        hasBreathingDifficulty: assessment.hasBreathingDifficulty,

        systolic: assessment.systolic,
        diastolic: assessment.diastolic,

        notes: assessment.notes,

        flaggedForReview: assessment.flaggedForReview,
        isUrgent: assessment.isUrgent,

        version: assessment.version,
        recordedBy: assessment.recordedBy,

        createdAt: assessment.createdAt,
        updatedAt: assessment.updatedAt,
    }
}

// --------------------------------------------------
// BACKGROUND JOB
// --------------------------------------------------

async function enqueueUrgentAssessment(assessmentId) {
    try {
        await urgentAssessmentQueue.add(
            'create-notification',
            { assessmentId },
            {
                // Avoid duplicate queued jobs for the same assessment.
                jobId: `urgent-assessment-${assessmentId}`,
            },
        )
    } catch (err) {
        // The assessment is already saved in PostgreSQL.
        // Do not report a failed create/update when Redis is unavailable.
        logger.error(
            { err, assessmentId },
            'Failed to enqueue urgent assessment notification',
        )
    }
}

// --------------------------------------------------
// CREATE ASSESSMENT
// --------------------------------------------------

async function createAssessment(data, user) {
    const clientId = data.clientId || randomUUID()

    const isUrgent = calculateUrgency(data)

    const assessmentId = await sequelize.transaction(
        async transaction => {
            // Verify that the member belongs to an accessible household.
            await lockAccessibleMember(
                data.memberId,
                user,
                transaction,
            )

            const assessment = await HealthAssessment.create(
                {
                    clientId,
                    memberId: data.memberId,

                    temperatureC: data.temperatureC ?? null,
                    hasFever: data.hasFever ?? false,
                    hasCough: data.hasCough ?? false,

                    hasBreathingDifficulty:
                        data.hasBreathingDifficulty ?? false,

                    systolic: data.systolic ?? null,
                    diastolic: data.diastolic ?? null,

                    notes: data.notes ?? null,

                    flaggedForReview:
                        data.flaggedForReview ?? false,

                    // Always calculated by backend.
                    isUrgent,

                    version: 1,
                    recordedBy: user.id,
                },
                { transaction },
            )

            return assessment.id
        },
    )

    const result = await findAccessibleAssessment(
        assessmentId,
        user,
    )

    // Enqueue after the database transaction commits.
    if (result.isUrgent) {
        await enqueueUrgentAssessment(result.id)
    }

    return toPublicAssessment(result)
}

// --------------------------------------------------
// LIST ASSESSMENTS
// --------------------------------------------------

async function listAssessments(filters, user) {
    const {
        page,
        limit,
        memberId,
        householdId,
        isUrgent,
        flaggedForReview,
    } = filters

    const where = {}

    if (isUrgent !== undefined) {
        where.isUrgent = isUrgent
    }

    if (flaggedForReview !== undefined) {
        where.flaggedForReview = flaggedForReview
    }

    const memberInclude = {
        model: HouseholdMember,
        as: 'member',
        required: true,

        attributes: [
            'id',
            'clientId',
            'name',
            'age',
            'gender',
            'relationship',
        ],

        include: [
            {
                model: Household,
                as: 'household',
                required: true,

                where: {
                    ...getAreaAccessWhere(user),
                },

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
    }

    if (memberId !== undefined) {
        memberInclude.where = { id: memberId }
    }

    if (householdId !== undefined) {
        memberInclude.include[0].where.id = householdId
    }

    const { rows, count } =
        await HealthAssessment.findAndCountAll({
            where,

            include: [memberInclude],

            order: [
                ['createdAt', 'DESC'],
                ['id', 'DESC'],
            ],

            limit,
            offset: (page - 1) * limit,
            distinct: true,
        })

    return {
        data: rows.map(toPublicAssessment),

        pagination: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
        },
    }
}

// --------------------------------------------------
// GET ASSESSMENT DETAILS
// --------------------------------------------------

async function getAssessmentDetails(id, user) {
    const assessment = await findAccessibleAssessment(id, user)

    return toPublicAssessment(assessment)
}

// --------------------------------------------------
// UPDATE ASSESSMENT
// --------------------------------------------------

async function updateAssessment(id, data, user) {
    const {
        version,
        ...updates
    } = data

    let updatedIsUrgent

    await sequelize.transaction(async transaction => {
        const assessment = await HealthAssessment.findByPk(
            id,
            {
                transaction,
                lock: transaction.LOCK.UPDATE,
            },
        )

        if (!assessment) {
            throw new NotFoundError('Health assessment not found')
        }

        // Verify that its parent member is accessible.
        await lockAccessibleMember(
            assessment.memberId,
            user,
            transaction,
        )

        if (assessment.version !== version) {
            throw new ConflictError(
                'Health assessment was modified by another user',
                {
                    expectedVersion: version,
                    currentVersion: assessment.version,
                },
            )
        }

        // Calculate urgency from existing and updated values.
        const nextValues = {
            temperatureC: assessment.temperatureC,
            hasFever: assessment.hasFever,
            hasCough: assessment.hasCough,
            hasBreathingDifficulty:
                assessment.hasBreathingDifficulty,
            flaggedForReview: assessment.flaggedForReview,
            ...updates,
        }

        updatedIsUrgent = calculateUrgency(nextValues)

        await assessment.update(
            {
                ...updates,
                isUrgent: updatedIsUrgent,
                version: version + 1,
            },
            { transaction },
        )
    })

    const result = await findAccessibleAssessment(id, user)

    if (result.isUrgent) {
        await enqueueUrgentAssessment(id)
    }

    return toPublicAssessment(result)
}

// --------------------------------------------------
// DELETE ASSESSMENT
// --------------------------------------------------

async function deleteAssessment(id, version, user) {
    await sequelize.transaction(async transaction => {
        const assessment = await HealthAssessment.findByPk(
            id,
            {
                transaction,
                lock: transaction.LOCK.UPDATE,
            },
        )

        if (!assessment) {
            throw new NotFoundError('Health assessment not found')
        }

        await lockAccessibleMember(
            assessment.memberId,
            user,
            transaction,
        )

        if (assessment.version !== version) {
            throw new ConflictError(
                'Health assessment was modified before deletion',
                {
                    expectedVersion: version,
                    currentVersion: assessment.version,
                },
            )
        }

        await assessment.update(
            { version: version + 1 },
            { transaction },
        )

        // Sequelize paranoid mode sets deleted_at.
        await assessment.destroy({ transaction })
    })

    return {
        id,
        deleted: true,
        version: version + 1,
    }
}

module.exports = {
    createAssessment,
    listAssessments,
    getAssessmentDetails,
    updateAssessment,
    deleteAssessment,
}
