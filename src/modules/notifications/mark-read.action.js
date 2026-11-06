const notificationsService = require('./notifications.service')

exports.markRead = async (req, res) => {
    const notification =
        await notificationsService.markNotificationRead(
            req.validated.params.id,
        )

    res.json({ data: notification })
}