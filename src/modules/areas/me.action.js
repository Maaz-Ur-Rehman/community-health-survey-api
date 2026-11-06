const areasService = require('./areas.service')

exports.me = async (req, res) => {
    const area = await areasService.getAssignedArea(req.user)
    res.json({ data: area })
}
