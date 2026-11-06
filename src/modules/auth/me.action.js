const { toPublicUser } = require('./auth.service')

exports.me = async (req, res) => {
    res.json({ data: toPublicUser(req.user) })
}
