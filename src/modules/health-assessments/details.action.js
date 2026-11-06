const assessmentsService = require('./health-assessments.service')

exports.details = async (req, res) => {
    const assessment = await assessmentsService.getAssessmentDetails(
        req.validated.params.id,
        req.user,
    )

    res.json({ data: assessment })
}