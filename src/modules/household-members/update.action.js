const membersService = require('./household-members.service')

exports.update = async (req, res) => {
    const member = await membersService.updateMember(
        req.validated.params.id,
        req.validated.body,
        req.user,
    )

    res.json({ data: member })
}