const membersService = require('./household-members.service')

exports.create = async (req, res) => {
    const member = await membersService.createMember(
        req.validated.body,
        req.user,
    )

    res.status(201).json({ data: member })
}