const { Queue } = require('bullmq')
const redis = require('../config/redis')

const urgentAssessmentQueue = new Queue('urgent-assessments', {
    connection: redis,

    defaultJobOptions: {
        attempts: 5,

        backoff: {
            type: 'exponential',
            delay: 2000,
        },

        removeOnComplete: {
            count: 1000,
        },

        removeOnFail: {
            count: 5000,
        },
    },
})

module.exports = urgentAssessmentQueue