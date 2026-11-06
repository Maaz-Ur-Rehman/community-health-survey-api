
const householdsService = require('./households.service')

exports.update = async (req, res) => {
    const household = await householdsService.updateHousehold(
        req.validated.params.id,
        req.validated.body,
        req.user,
    )

    res.json({ data: household })
}
