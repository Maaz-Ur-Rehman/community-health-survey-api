const membersService = require('./household-members.service')

exports.remove = async (req, res) => {
    const result = await membersService.deleteMember(
        req.validated.params.id,
        req.validated.body.version,
        req.user,
    )

    res.json({ data: result })
}