const usersService = require('./users.service')

exports.updateStatus = async (req, res) => {
    const worker = await usersService.updateWorkerStatus(
        req.validated.params.id,
        req.validated.body.isActive,
    )

    res.json({ data: worker })
}