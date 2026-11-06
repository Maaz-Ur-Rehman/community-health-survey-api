const assessmentsService = require('./health-assessments.service')

exports.create = async (req, res) => {
    const assessment = await assessmentsService.createAssessment(
        req.validated.body,
        req.user,
    )

    res.status(201).json({ data: assessment })
}