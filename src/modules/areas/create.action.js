const areasService = require('./areas.service')

exports.create = async (req, res) => {
    const area = await areasService.createArea(req.validated.body)
    res.status(201).json({ data: area })
}
