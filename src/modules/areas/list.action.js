const areasService = require('./areas.service')

exports.list = async (req, res) => {
    const areas = await areasService.listAreas()
    res.json({ data: areas })
}
