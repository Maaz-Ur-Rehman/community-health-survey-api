const syncService = require('./synchronization.service')

exports.push = async (req, res) => {
    const result = await syncService.pushOperations(
        req.validated.body.operations,
        req.user,
    )

    res.json({
        data: result,
    })
}