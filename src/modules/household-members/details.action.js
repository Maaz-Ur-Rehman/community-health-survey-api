const membersService = require('./household-members.service')

exports.details = async (req, res) => {
    const member = await membersService.getMemberDetails(
        req.validated.params.id,
        req.user,
    )

    res.json({ data: member })
}