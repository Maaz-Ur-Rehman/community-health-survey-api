
const householdsService = require('./households.service')

exports.list = async (req, res) => {
    const result = await householdsService.listHouseholds(
        req.validated.query,
        req.user,
    )

    res.json(result)
}
