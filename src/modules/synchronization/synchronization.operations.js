
const {
    Household,
    HouseholdMember,
    HealthAssessment,
} = require('../../database/models')

const {
    ConflictError,
    ForbiddenError,
    NotFoundError,
} = require('../../common/errors/AppError')

function ensureAssignedArea(user) {
    if (!user.areaId) {
        throw new ForbiddenError(
            'You are not assigned to any area',
        )
    }

    return user.areaId
}

function calculateUrgency(data) {
    return (
        Number(data.temperatureC) >= 38 ||
        data.hasFever === true ||
        data.hasBreathingDifficulty === true ||
        data.flaggedForReview === true
    )
}

// ---------------- RESPONSE FORMATTERS ----------------

function formatHousehold(record) {
    return {
        id: record.id,
        clientId: record.clientId,
        householdCode: record.householdCode,
        areaId: record.areaId,
        address: record.address,
        latitude: record.latitude,
        longitude: record.longitude,
        version: record.version,
        createdBy: record.createdBy,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        deletedAt: record.deletedAt,
    }
}

function formatMember(record, household) {
    return {
        id: record.id,
        clientId: record.clientId,
        householdId: record.householdId,
        householdClientId: household.clientId,
        name: record.name,
        age: record.age,
        gender: record.gender,
        relationship: record.relationship,
        version: record.version,
        createdBy: record.createdBy,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        deletedAt: record.deletedAt,
    }
}

function formatAssessment(record, member) {
    return {
        id: record.id,
        clientId: record.clientId,
        memberId: record.memberId,
        memberClientId: member.clientId,
        temperatureC: record.temperatureC,
        hasFever: record.hasFever,
        hasCough: record.hasCough,
        hasBreathingDifficulty: record.hasBreathingDifficulty,
        systolic: record.systolic,
        diastolic: record.diastolic,
        notes: record.notes,
        flaggedForReview: record.flaggedForReview,
        isUrgent: record.isUrgent,
        version: record.version,
        recordedBy: record.recordedBy,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        deletedAt: record.deletedAt,
    }
}

// ---------------- HOUSEHOLD ACCESS ----------------

async function getHousehold(clientId, user, transaction) {
    const areaId = ensureAssignedArea(user)

    const household = await Household.findOne({
        where: {
            clientId,
            areaId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
    })

    if (!household) {
        throw new NotFoundError('Household not found')
    }

    return household
}

// ---------------- MEMBER ACCESS ----------------

async function getMember(clientId, user, transaction) {
    const areaId = ensureAssignedArea(user)

    const reference = await HouseholdMember.findOne({
        where: { clientId },
        transaction,
    })

    if (!reference) {
        throw new NotFoundError('Household member not found')
    }

    const household = await Household.findOne({
        where: {
            id: reference.householdId,
            areaId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
    })

    if (!household) {
        throw new NotFoundError('Household member not found')
    }

    const member = await HouseholdMember.findOne({
        where: {
            id: reference.id,
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

// ---------------- ASSESSMENT ACCESS ----------------

async function getAssessment(clientId, user, transaction) {
    const reference = await HealthAssessment.findOne({
        where: { clientId },
        transaction,
    })

    if (!reference) {
        throw new NotFoundError('Health assessment not found')
    }

    const { member, household } = await getMemberById(
        reference.memberId,
        user,
        transaction,
    )

    const assessment = await HealthAssessment.findOne({
        where: {
            id: reference.id,
            memberId: member.id,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
    })

    if (!assessment) {
        throw new NotFoundError('Health assessment not found')
    }

    return { assessment, member, household }
}

async function getMemberById(id, user, transaction) {
    const areaId = ensureAssignedArea(user)

    const reference = await HouseholdMember.findByPk(id, {
        transaction,
    })

    if (!reference) {
        throw new NotFoundError('Household member not found')
    }

    const household = await Household.findOne({
        where: {
            id: reference.householdId,
            areaId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
    })

    if (!household) {
        throw new NotFoundError('Household member not found')
    }

    const member = await HouseholdMember.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
    })

    if (!member) {
        throw new NotFoundError('Household member not found')
    }

    return { member, household }
}

// ---------------- CONFLICT RESPONSE ----------------

function ensureVersion(record, operation, formatter) {
    if (record.version !== operation.baseVersion) {
        throw new ConflictError(
            'Record was modified by another user',
            {
                expectedVersion: operation.baseVersion,
                currentVersion: record.version,
                serverRecord: formatter(),
            },
        )
    }
}

// ---------------- CREATE OPERATIONS ----------------

async function createHousehold(operation, user, transaction) {
    const areaId = ensureAssignedArea(user)

    const record = await Household.create(
        {
            clientId: operation.clientId,
            householdCode: operation.data.householdCode
                .trim()
                .toUpperCase(),
            areaId,
            address: operation.data.address,
            latitude: operation.data.latitude ?? null,
            longitude: operation.data.longitude ?? null,
            version: 1,
            createdBy: user.id,
        },
        { transaction },
    )

    return formatHousehold(record)
}

async function createMember(operation, user, transaction) {
    const household = await getHousehold(
        operation.data.householdClientId,
        user,
        transaction,
    )

    const record = await HouseholdMember.create(
        {
            clientId: operation.clientId,
            householdId: household.id,
            name: operation.data.name,
            age: operation.data.age,
            gender: operation.data.gender,
            relationship: operation.data.relationship,
            version: 1,
            createdBy: user.id,
        },
        { transaction },
    )

    return formatMember(record, household)
}

async function createAssessment(operation, user, transaction) {
    const { member, household } = await getMember(
        operation.data.memberClientId,
        user,
        transaction,
    )

    const data = operation.data
    const isUrgent = calculateUrgency(data)

    const record = await HealthAssessment.create(
        {
            clientId: operation.clientId,
            memberId: member.id,
            temperatureC: data.temperatureC ?? null,
            hasFever: data.hasFever ?? false,
            hasCough: data.hasCough ?? false,
            hasBreathingDifficulty:
                data.hasBreathingDifficulty ?? false,
            systolic: data.systolic ?? null,
            diastolic: data.diastolic ?? null,
            notes: data.notes ?? null,
            flaggedForReview: data.flaggedForReview ?? false,
            isUrgent,
            version: 1,
            recordedBy: user.id,
        },
        { transaction },
    )

    return formatAssessment(record, member)
}

// ---------------- UPDATE OPERATIONS ----------------

async function updateHousehold(operation, user, transaction) {
    const record = await getHousehold(
        operation.clientId,
        user,
        transaction,
    )

    ensureVersion(record, operation, () => formatHousehold(record))

    await record.update(
        {
            ...operation.data,
            version: record.version + 1,
        },
        { transaction },
    )

    return formatHousehold(record)
}

async function updateMember(operation, user, transaction) {
    const { member, household } = await getMember(
        operation.clientId,
        user,
        transaction,
    )

    ensureVersion(member, operation, () =>
        formatMember(member, household),
    )

    await member.update(
        {
            ...operation.data,
            version: member.version + 1,
        },
        { transaction },
    )

    return formatMember(member, household)
}

async function updateAssessment(operation, user, transaction) {
    const { assessment, member } = await getAssessment(
        operation.clientId,
        user,
        transaction,
    )

    ensureVersion(assessment, operation, () =>
        formatAssessment(assessment, member),
    )

    const nextValues = {
        temperatureC: assessment.temperatureC,
        hasFever: assessment.hasFever,
        hasCough: assessment.hasCough,
        hasBreathingDifficulty: assessment.hasBreathingDifficulty,
        flaggedForReview: assessment.flaggedForReview,
        ...operation.data,
    }

    await assessment.update(
        {
            ...operation.data,
            isUrgent: calculateUrgency(nextValues),
            version: assessment.version + 1,
        },
        { transaction },
    )

    return formatAssessment(assessment, member)
}

// ---------------- DELETE OPERATIONS ----------------

// Version is incremented before Sequelize sets deleted_at.
async function softDelete(record, transaction) {
    const nextVersion = record.version + 1

    await record.update(
        { version: nextVersion },
        { transaction },
    )

    await record.destroy({ transaction })

    return {
        id: record.id,
        clientId: record.clientId,
        version: nextVersion,
        deletedAt: record.deletedAt,
        updatedAt: record.updatedAt,
    }
}

async function deleteHousehold(operation, user, transaction) {
    const household = await getHousehold(
        operation.clientId,
        user,
        transaction,
    )

    ensureVersion(household, operation, () =>
        formatHousehold(household),
    )

    const result = await softDelete(household, transaction)

    return {
        ...formatHousehold(household),
        ...result,
    }
}

async function deleteMember(operation, user, transaction) {
    const { member } = await getMember(
        operation.clientId,
        user,
        transaction,
    )

    ensureVersion(member, operation, () =>
        formatMember(member, {
            id: member.householdId,
            clientId: null,
        }),
    )

    return softDelete(member, transaction)
}

async function deleteAssessment(operation, user, transaction) {
    const { assessment } = await getAssessment(
        operation.clientId,
        user,
        transaction,
    )

    ensureVersion(assessment, operation, () =>
        ({
            id: assessment.id,
            clientId: assessment.clientId,
            version: assessment.version,
        }),
    )

    return softDelete(assessment, transaction)
}

// ---------------- OPERATION DISPATCHER ----------------

async function applyEntityOperation(operation, user, transaction) {
    let record

    if (operation.entity === 'HOUSEHOLD') {
        if (operation.action === 'CREATE') {
            record = await createHousehold(
                operation, user, transaction,
            )
        } else if (operation.action === 'UPDATE') {
            record = await updateHousehold(
                operation, user, transaction,
            )
        } else {
            record = await deleteHousehold(
                operation, user, transaction,
            )
        }
    }

    if (operation.entity === 'HOUSEHOLD_MEMBER') {
        if (operation.action === 'CREATE') {
            record = await createMember(
                operation, user, transaction,
            )
        } else if (operation.action === 'UPDATE') {
            record = await updateMember(
                operation, user, transaction,
            )
        } else {
            record = await deleteMember(
                operation, user, transaction,
            )
        }
    }

    if (operation.entity === 'HEALTH_ASSESSMENT') {
        if (operation.action === 'CREATE') {
            record = await createAssessment(
                operation, user, transaction,
            )
        } else if (operation.action === 'UPDATE') {
            record = await updateAssessment(
                operation, user, transaction,
            )
        } else {
            record = await deleteAssessment(
                operation, user, transaction,
            )
        }
    }

    return {
        opId: operation.opId,
        entity: operation.entity,
        action: operation.action,
        clientId: operation.clientId,
        status: 'applied',
        serverId: record.id,
        version: record.version,
        record,
    }
}

module.exports = {
    applyEntityOperation,
}
