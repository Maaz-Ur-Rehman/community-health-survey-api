const assessmentsService = require('./health-assessments.service')

exports.update = async (req, res) => {
    const assessment = await assessmentsService.updateAssessment(
        req.validated.params.id,
        req.validated.body,
        req.user,
    )

    res.json({ data: assessment })
}