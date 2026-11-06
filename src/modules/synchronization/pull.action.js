const syncPullService = require('./synchronization.pull.service')

exports.pull = async (req, res) => {
    const result = await syncPullService.pullChanges(
        req.validated.query,
        req.user,
    )

    res.json(result)
}