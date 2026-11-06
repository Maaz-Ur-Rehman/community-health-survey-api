
const bcrypt = require('bcrypt')
const { Op } = require('sequelize')

const {
    sequelize,
    User,
    Area,
    RefreshToken,
} = require('../../database/models')

const {
    ConflictError,
    NotFoundError,
} = require('../../common/errors/AppError')

const AREA_INCLUDE = {
    model: Area,
    as: 'area',
    attributes: ['id', 'code', 'name'],
}

function toPublicWorker(worker) {
    return {
        id: worker.id,
        name: worker.name,
        email: worker.email,
        role: worker.role,
        isActive: worker.isActive,
        areaId: worker.areaId,
        area: worker.area
            ? {
                id: worker.area.id,
                code: worker.area.code,
                name: worker.area.name,
            }
            : null,
        createdAt: worker.createdAt,
        updatedAt: worker.updatedAt,
    }
}

async function findFieldWorker(id) {
    const worker = await User.findOne({
        where: {
            id,
            role: 'FIELD_WORKER',
        },
        include: [AREA_INCLUDE],
    })

    if (!worker) {
        throw new NotFoundError('Field worker not found')
    }

    return worker
}

async function validateArea(areaId) {
    if (areaId == null) return

    const area = await Area.findByPk(areaId)

    if (!area) {
        throw new NotFoundError('Area not found')
    }
}

// CREATE FIELD WORKER
async function createWorker(data) {
    const email = data.email.trim().toLowerCase()

    const existing = await User.findOne({
        where: { email },
    })

    if (existing) {
        throw new ConflictError('Email is already registered')
    }

    await validateArea(data.areaId)

    const passwordHash = await bcrypt.hash(data.password, 12)

    const worker = await User.create({
        name: data.name,
        email,
        passwordHash,
        role: 'FIELD_WORKER',
        isActive: true,
        areaId: data.areaId ?? null,
    })

    const result = await findFieldWorker(worker.id)

    return toPublicWorker(result)
}

// LIST FIELD WORKERS
async function listWorkers(filters) {
    const {
        page,
        limit,
        search,
        areaId,
        isActive,
    } = filters

    const where = {
        role: 'FIELD_WORKER',
    }

    if (search) {
        where[Op.or] = [
            { name: { [Op.iLike]: `%${search}%` } },
            { email: { [Op.iLike]: `%${search}%` } },
        ]
    }

    if (areaId !== undefined) {
        where.areaId = areaId
    }

    if (isActive !== undefined) {
        where.isActive = isActive
    }

    const { rows, count } = await User.findAndCountAll({
        where,
        include: [AREA_INCLUDE],
        order: [
            ['createdAt', 'DESC'],
            ['id', 'DESC'],
        ],
        limit,
        offset: (page - 1) * limit,
        distinct: true,
    })

    return {
        data: rows.map(toPublicWorker),
        pagination: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
        },
    }
}

// GET WORKER DETAILS
async function getWorkerDetails(id) {
    const worker = await findFieldWorker(id)

    return toPublicWorker(worker)
}

// UPDATE WORKER INFORMATION
async function updateWorker(id, data) {
    const worker = await findFieldWorker(id)

    const updates = {}

    if (data.name !== undefined) {
        updates.name = data.name
    }

    if (data.email !== undefined) {
        const email = data.email.trim().toLowerCase()

        const existing = await User.findOne({
            where: {
                email,
                id: { [Op.ne]: id },
            },
        })

        if (existing) {
            throw new ConflictError('Email is already registered')
        }

        updates.email = email
    }

    await worker.update(updates)

    const updatedWorker = await findFieldWorker(id)

    return toPublicWorker(updatedWorker)
}

// ACTIVATE / DEACTIVATE WORKER
async function updateWorkerStatus(id, isActive) {
    const worker = await findFieldWorker(id)

    await sequelize.transaction(async transaction => {
        await worker.update(
            { isActive },
            { transaction },
        )

        // Revoke all refresh tokens when deactivating.
        // Reactivating the worker will not restore old sessions.
        if (!isActive) {
            await RefreshToken.update(
                { revokedAt: new Date() },
                {
                    where: {
                        userId: id,
                        revokedAt: { [Op.is]: null },
                    },
                    transaction,
                },
            )
        }
    })

    const updatedWorker = await findFieldWorker(id)

    return toPublicWorker(updatedWorker)
}

// ASSIGN / REASSIGN AREA
async function assignWorkerArea(id, areaId) {
    const worker = await findFieldWorker(id)

    await validateArea(areaId)

    await worker.update({
        areaId,
    })

    const updatedWorker = await findFieldWorker(id)

    return toPublicWorker(updatedWorker)
}

module.exports = {
    createWorker,
    listWorkers,
    getWorkerDetails,
    updateWorker,
    updateWorkerStatus,
    assignWorkerArea,
}
