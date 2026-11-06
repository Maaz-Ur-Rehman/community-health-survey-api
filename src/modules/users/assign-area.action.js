const usersService = require('./users.service')

exports.assignArea = async (req, res) => {
    const worker = await usersService.assignWorkerArea(
        req.validated.params.id,
        req.validated.body.areaId,
    )

    res.json({ data: worker })
}