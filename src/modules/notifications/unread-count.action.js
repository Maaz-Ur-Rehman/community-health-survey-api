const notificationsService = require('./notifications.service')

exports.unreadCount = async (req, res) => {
    const result = await notificationsService.getUnreadCount()

    res.json({ data: result })
}