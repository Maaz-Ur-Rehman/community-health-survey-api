const assessmentsService = require('./health-assessments.service')

exports.list = async (req, res) => {
    const result = await assessmentsService.listAssessments(
        req.validated.query,
        req.user,
    )

    res.json(result)
}