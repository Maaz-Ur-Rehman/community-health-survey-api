const notificationsService = require('./notifications.service')

exports.list = async (req, res) => {
    const result = await notificationsService.listNotifications(
        req.validated.query,
    )

    res.json(result)
}