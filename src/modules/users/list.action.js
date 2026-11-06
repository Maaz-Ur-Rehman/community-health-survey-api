const usersService = require('./users.service')

exports.list = async (req, res) => {
    const result = await usersService.listWorkers(
        req.validated.query,
    )

    res.json(result)
}