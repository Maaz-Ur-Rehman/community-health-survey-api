
const householdsService = require('./households.service')

exports.remove = async (req, res) => {
    const result = await householdsService.deleteHousehold(
        req.validated.params.id,
        req.validated.body.version,
        req.user,
    )

    res.json({ data: result })
}
