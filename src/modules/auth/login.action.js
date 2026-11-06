const authService = require('./auth.service')

exports.login = async (req, res) => {
    const result = await authService.login(req.validated.body)
    res.json({ data: result })
}
