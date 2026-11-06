
const householdsService = require('./households.service')

exports.create = async (req, res) => {
    const household = await householdsService.createHousehold(
        req.validated.body,
        req.user,
    )

    res.status(201).json({ data: household })
}
