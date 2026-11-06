
const { randomUUID } = require('node:crypto')
const { Op } = require('sequelize')

const {
    sequelize,
    Household,
    HouseholdMember,
    Area,
} = require('../../database/models')

const {
    BadRequestError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
} = require('../../common/errors/AppError')

// Only Super Admin can access all areas.
// Field Workers are restricted to their assigned area.
function getAccessWhere(user) {
    if (user.role === 'FIELD_WORKER') {
        return { areaId: user.areaId || -1 }
    }

    return {}
}

// Validate that an area exists.
async function validateArea(areaId) {
    const area = await Area.findByPk(areaId)

    if (!area) {
        throw new NotFoundError('Area not found')
    }

    return area
}

// Find a household accessible to the current user.
async function findAccessibleHousehold(id, user, options = {}) {
    const household = await Household.findOne({
        where: {
            id,
            ...getAccessWhere(user),
        },
        include: options.include || [
            {
                model: Area,
                as: 'area',
                attributes: ['id', 'code', 'name'],
            },
        ],
        transaction: options.transaction,
    })

    if (!household) {
        throw new NotFoundError('Household not found')
    }

    return household
}

// Format API response.
function toPublicHousehold(household) {
    return {
        id: household.id,
        clientId: household.clientId,
        householdCode: household.householdCode,
        areaId: household.areaId,
        area: household.area
            ? {
                id: household.area.id,
                code: household.area.code,
                name: household.area.name,
            }
            : null,
        address: household.address,
        latitude: household.latitude,
        longitude: household.longitude,
        version: household.version,
        createdBy: household.createdBy,
        createdAt: household.createdAt,
        updatedAt: household.updatedAt,

        ...(household.members !== undefined && {
            members: household.members.map(member => ({
                id: member.id,
                clientId: member.clientId,
                name: member.name,
                age: member.age,
                gender: member.gender,
                relationship: member.relationship,
                version: member.version,
            })),
        }),
    }
}

// CREATE HOUSEHOLD
async function createHousehold(data, user) {
    let areaId

    if (user.role === 'FIELD_WORKER') {
        if (!user.areaId) {
            throw new ForbiddenError(
                'You are not assigned to any area',
            )
        }

        // Prevent a field worker from registering a household
        // in another area.
        if (data.areaId !== undefined && data.areaId !== user.areaId) {
            throw new ForbiddenError(
                'You can only register households in your assigned area',
            )
        }

        areaId = user.areaId
    } else {
        if (!data.areaId) {
            throw new BadRequestError(
                'Area ID is required for Super Admin',
            )
        }

        areaId = data.areaId
    }

    await validateArea(areaId)

    const householdCode = data.householdCode.trim().toUpperCase()

    const existing = await Household.findOne({
        where: { householdCode },
    })

    if (existing) {
        throw new ConflictError(
            'Household code is already registered',
        )
    }

    const household = await Household.create({
        clientId: data.clientId || randomUUID(),
        householdCode,
        areaId,
        address: data.address,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        createdBy: user.id,
    })

    const result = await findAccessibleHousehold(
        household.id,
        user,
    )

    return toPublicHousehold(result)
}

// LIST HOUSEHOLDS
async function listHouseholds(filters, user) {
    const {
        page,
        limit,
        search,
        areaId,
    } = filters

    const where = {
        ...getAccessWhere(user),
    }

    // Field workers cannot change their area filter.
    if (
        user.role === 'FIELD_WORKER' &&
        areaId !== undefined &&
        areaId !== user.areaId
    ) {
        throw new ForbiddenError(
            'You can only access households in your assigned area',
        )
    }

    if (user.role === 'SUPER_ADMIN' && areaId !== undefined) {
        where.areaId = areaId
    }

    if (search) {
        where[Op.or] = [
            {
                householdCode: {
                    [Op.iLike]: `%${search}%`,
                },
            },
            {
                address: {
                    [Op.iLike]: `%${search}%`,
                },
            },
        ]
    }

    const { rows, count } = await Household.findAndCountAll({
        where,

        include: [
            {
                model: Area,
                as: 'area',
                attributes: ['id', 'code', 'name'],
            },
        ],

        order: [
            ['createdAt', 'DESC'],
            ['id', 'DESC'],
        ],

        limit,
        offset: (page - 1) * limit,
        distinct: true,
    })

    return {
        data: rows.map(toPublicHousehold),

        pagination: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
        },
    }
}

// GET HOUSEHOLD DETAILS WITH MEMBERS
async function getHouseholdDetails(id, user) {
    const household = await findAccessibleHousehold(
        id,
        user,
        {
            include: [
                {
                    model: Area,
                    as: 'area',
                    attributes: ['id', 'code', 'name'],
                },
                {
                    model: HouseholdMember,
                    as: 'members',
                    attributes: [
                        'id',
                        'clientId',
                        'householdId',
                        'name',
                        'age',
                        'gender',
                        'relationship',
                        'version',
                        'createdAt',
                        'updatedAt',
                    ],
                },
            ],
        },
    )

    return toPublicHousehold(household)
}

// UPDATE HOUSEHOLD
async function updateHousehold(id, data, user) {
    const isFieldWorker = user.role === 'FIELD_WORKER'

    // Workers cannot change the household's area or code.
    if (
        isFieldWorker &&
        (data.areaId !== undefined ||
            data.householdCode !== undefined)
    ) {
        throw new ForbiddenError(
            'You cannot change the household code or area',
        )
    }

    if (data.areaId !== undefined) {
        await validateArea(data.areaId)
    }

    const updates = {}

    if (data.householdCode !== undefined) {
        updates.householdCode = data.householdCode
            .trim()
            .toUpperCase()

        const existing = await Household.findOne({
            where: {
                householdCode: updates.householdCode,
                id: { [Op.ne]: id },
            },
        })

        if (existing) {
            throw new ConflictError(
                'Household code is already registered',
            )
        }
    }

    if (data.address !== undefined) {
        updates.address = data.address
    }

    if (data.areaId !== undefined) {
        updates.areaId = data.areaId
    }

    if (data.latitude !== undefined) {
        updates.latitude = data.latitude
    }

    if (data.longitude !== undefined) {
        updates.longitude = data.longitude
    }

    // Atomic version check and update.
    await sequelize.transaction(async transaction => {
        const [affected] = await Household.update(
            {
                ...updates,
                version: data.version + 1,
            },
            {
                where: {
                    id,
                    version: data.version,
                    ...getAccessWhere(user),
                },
                transaction,
            },
        )

        if (affected !== 1) {
            const current = await Household.findOne({
                where: {
                    id,
                    ...getAccessWhere(user),
                },
                transaction,
            })

            if (!current) {
                throw new NotFoundError('Household not found')
            }

            throw new ConflictError(
                'Household was modified by another user',
                {
                    expectedVersion: data.version,
                    currentVersion: current.version,
                },
            )
        }
    })

    const updated = await findAccessibleHousehold(id, user)

    return toPublicHousehold(updated)
}

// SOFT DELETE HOUSEHOLD
async function deleteHousehold(id, version, user) {
    await sequelize.transaction(async transaction => {
        // Increment the version only if it still matches.
        const [affected] = await Household.update(
            {
                version: version + 1,
            },
            {
                where: {
                    id,
                    version,
                    ...getAccessWhere(user),
                },
                transaction,
            },
        )

        if (affected !== 1) {
            const current = await Household.findOne({
                where: {
                    id,
                    ...getAccessWhere(user),
                },
                transaction,
            })

            if (!current) {
                throw new NotFoundError('Household not found')
            }

            throw new ConflictError(
                'Household was modified before deletion',
                {
                    expectedVersion: version,
                    currentVersion: current.version,
                },
            )
        }

        // Sequelize paranoid mode sets deletedAt.
        await Household.destroy({
            where: {
                id,
                version: version + 1,
                ...getAccessWhere(user),
            },
            transaction,
        })
    })

    return {
        id,
        deleted: true,
        version: version + 1,
    }
}

module.exports = {
    createHousehold,
    listHouseholds,
    getHouseholdDetails,
    updateHousehold,
    deleteHousehold,
}
