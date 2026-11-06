const usersService = require('./users.service')

exports.update = async (req, res) => {
    const worker = await usersService.updateWorker(
        req.validated.params.id,
        req.validated.body,
    )

    res.json({ data: worker })
}