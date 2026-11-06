const usersService = require('./users.service')

exports.create = async (req, res) => {
    const worker = await usersService.createWorker(
        req.validated.body,
    )

    res.status(201).json({ data: worker })
}