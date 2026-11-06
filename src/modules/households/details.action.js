
const householdsService = require('./households.service')

exports.details = async (req, res) => {
    const household = await householdsService.getHouseholdDetails(
        req.validated.params.id,
        req.user,
    )

    res.json({ data: household })
}
