const assessmentsService = require('./health-assessments.service')

exports.remove = async (req, res) => {
    const result = await assessmentsService.deleteAssessment(
        req.validated.params.id,
        req.validated.body.version,
        req.user,
    )

    res.json({ data: result })
}