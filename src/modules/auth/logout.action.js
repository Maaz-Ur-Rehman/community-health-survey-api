const authService = require('./auth.service')

exports.logout = async (req, res) => {
    await authService.logout(req.validated.body.refreshToken)
    res.status(204).end()
}
