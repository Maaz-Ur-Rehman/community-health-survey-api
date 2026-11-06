
const { randomUUID } = require('node:crypto')
const { Op } = require('sequelize')

const {
    sequelize,
    Household,
    HouseholdMember,
    Area,
} = require('../../database/models')

const {
    ConflictError,
    NotFoundError,
} = require('../../common/errors/AppError')

// Field workers can access only their assigned area.
function getHouseholdAccessWhere(user) {
    if (user.role === 'FIELD_WORKER') {
        return { areaId: user.areaId || -1 }
    }

    return {}
}

// Find an accessible household.
async function findAccessibleHousehold(
    householdId,
    user,
    options = {},
) {
    const household = await Household.findOne({
        where: {
            id: householdId,
            ...getHouseholdAccessWhere(user),
        },
        transaction: options.transaction,
        lock: options.lock
            ? options.transaction.LOCK.UPDATE
            : undefined,
    })

    if (!household) {
        throw new NotFoundError('Household not found')
    }

    return household
}

// Get household with its area for API responses.
async function getHouseholdWithArea(householdId, user) {
    const household = await Household.findOne({
        where: {
            id: householdId,
            ...getHouseholdAccessWhere(user),
        },
        include: [
            {
                model: Area,
                as: 'area',
                attributes: ['id', 'code', 'name'],
            },
        ],
    })

    if (!household) {
        throw new NotFoundError('Household not found')
    }

    return household
}

// Find a member whose parent household is accessible.
async function findAccessibleMember(id, user) {
    const member = await HouseholdMember.findOne({
        where: { id },

        include: [
            {
                model: Household,
                as: 'household',
                required: true,

                where: getHouseholdAccessWhere(user),

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

// Lock parent household and member before writing.
// This also protects against concurrent area reassignment.
async function lockAccessibleMember(id, user, transaction) {
    const reference = await HouseholdMember.findByPk(id, {
        transaction,
    })

    if (!reference) {
        throw new NotFoundError('Household member not found')
    }

    const household = await Household.findOne({
        where: {
            id: reference.householdId,
            ...getHouseholdAccessWhere(user),
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
    })

    if (!household) {
        throw new NotFoundError('Household member not found')
    }

    const member = await HouseholdMember.findOne({
        where: {
            id,
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

// Public response formatter.
function toPublicMember(member, household = member.household) {
    return {
        id: member.id,
        clientId: member.clientId,
        householdId: member.householdId,
        name: member.name,
        age: member.age,
        gender: member.gender,
        relationship: member.relationship,
        version: member.version,
        createdBy: member.createdBy,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,

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
    }
}

// CREATE MEMBER

async function createMember(data, user) {
    // Generate UUID when the mobile application doesn't provide one.
    const clientId = data.clientId || randomUUID()

    // Create member inside a database transaction.
    const { member, household } = await sequelize.transaction(
        async transaction => {

            // Verify household access and lock the parent record.
            const household = await findAccessibleHousehold(
                data.householdId,
                user,
                {
                    transaction,
                    lock: true,
                },
            )

            // Create household member.
            const member = await HouseholdMember.create(
                {
                    clientId,
                    householdId: household.id,
                    name: data.name,
                    age: data.age,
                    gender: data.gender,
                    relationship: data.relationship,
                    version: 1,
                    createdBy: user.id,
                },
                { transaction },
            )

            return {
                member,
                household,
            }
        },
    )

    // Return the created Sequelize instances directly.
    return toPublicMember(member, household)
}


// LIST MEMBERS
async function listMembers(filters, user) {
    const {
        householdId,
        page,
        limit,
        search,
    } = filters

    // Verify that this household belongs to an accessible area.
    const household = await getHouseholdWithArea(
        householdId,
        user,
    )

    const where = {
        householdId: household.id,
    }

    if (search) {
        where.name = {
            [Op.iLike]: `%${search}%`,
        }
    }

    const { rows, count } = await HouseholdMember.findAndCountAll({
        where,

        order: [
            ['createdAt', 'DESC'],
            ['id', 'DESC'],
        ],

        limit,
        offset: (page - 1) * limit,
    })

    return {
        data: rows.map(member =>
            toPublicMember(member, household),
        ),

        pagination: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
        },
    }
}

// GET MEMBER DETAILS
async function getMemberDetails(id, user) {
    const member = await findAccessibleMember(id, user)

    return toPublicMember(member)
}

// UPDATE MEMBER
async function updateMember(id, data, user) {
    const updates = {}

    if (data.name !== undefined) {
        updates.name = data.name
    }

    if (data.age !== undefined) {
        updates.age = data.age
    }

    if (data.gender !== undefined) {
        updates.gender = data.gender
    }

    if (data.relationship !== undefined) {
        updates.relationship = data.relationship
    }

    await sequelize.transaction(async transaction => {
        const { member, household } =
            await lockAccessibleMember(id, user, transaction)

        // Detect outdated mobile or admin data.
        if (member.version !== data.version) {
            throw new ConflictError(
                'Household member was modified by another user',
                {
                    expectedVersion: data.version,
                    currentVersion: member.version,
                },
            )
        }

        const [affected] = await HouseholdMember.update(
            {
                ...updates,
                version: data.version + 1,
            },
            {
                where: {
                    id,
                    householdId: household.id,
                    version: data.version,
                },
                transaction,
            },
        )

        if (affected !== 1) {
            throw new ConflictError(
                'Household member update conflict',
            )
        }
    })

    const updated = await findAccessibleMember(id, user)

    return toPublicMember(updated)
}

// SOFT DELETE MEMBER
async function deleteMember(id, version, user) {
    await sequelize.transaction(async transaction => {
        const { member, household } =
            await lockAccessibleMember(id, user, transaction)

        if (member.version !== version) {
            throw new ConflictError(
                'Household member was modified before deletion',
                {
                    expectedVersion: version,
                    currentVersion: member.version,
                },
            )
        }

        // Increment version before creating the deletion tombstone.
        const [affected] = await HouseholdMember.update(
            {
                version: version + 1,
            },
            {
                where: {
                    id,
                    householdId: household.id,
                    version,
                },
                transaction,
            },
        )

        if (affected !== 1) {
            throw new ConflictError(
                'Household member deletion conflict',
            )
        }

        // paranoid: true means deleted_at is updated.
        const deleted = await HouseholdMember.destroy({
            where: {
                id,
                householdId: household.id,
                version: version + 1,
            },
            transaction,
        })

        if (deleted !== 1) {
            throw new ConflictError(
                'Unable to delete household member',
            )
        }
    })

    return {
        id,
        deleted: true,
        version: version + 1,
    }
}

module.exports = {
    createMember,
    listMembers,
    getMemberDetails,
    updateMember,
    deleteMember,
}
