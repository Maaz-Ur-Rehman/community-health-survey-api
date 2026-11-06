const { Area } = require('../../database/models')
const { ConflictError, NotFoundError } = require('../../common/errors/AppError')

async function listAreas() {
    return Area.findAll({ order: [['name', 'ASC']] })
}

async function createArea(data) {
    const exists = await Area.findOne({ where: { name: data.name } })
    if (exists) throw new ConflictError('An area with this name already exists')
    return Area.create(data)
}

async function getArea(id) {
    const area = await Area.findByPk(id)
    if (!area) throw new NotFoundError('Area not found')
    return area
}

// The area a field worker is assigned to (null if not assigned yet)
async function getAssignedArea(user) {
    if (!user.areaId) return null
    return Area.findByPk(user.areaId)
}

module.exports = { listAreas, createArea, getArea, getAssignedArea }
