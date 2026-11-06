const notificationsService = require('./notifications.service')

exports.markAllRead = async (req, res) => {
    const result =
        await notificationsService.markAllNotificationsRead()

    res.json({ data: result })
}