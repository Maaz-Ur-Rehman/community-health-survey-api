const usersService = require('./users.service')

exports.details = async (req, res) => {
    const worker = await usersService.getWorkerDetails(
        req.validated.params.id,
    )

    res.json({ data: worker })
}