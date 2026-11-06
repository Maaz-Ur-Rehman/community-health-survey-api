const authService = require('./auth.service')

exports.refresh = async (req, res) => {
    const result = await authService.refresh(req.validated.body.refreshToken)
    res.json({ data: result })
}
