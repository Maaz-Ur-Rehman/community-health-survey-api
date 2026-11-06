const membersService = require('./household-members.service')

exports.list = async (req, res) => {
    const result = await membersService.listMembers(
        req.validated.query,
        req.user,
    )

    res.json(result)
}