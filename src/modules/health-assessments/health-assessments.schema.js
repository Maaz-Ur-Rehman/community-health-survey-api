
const { z } = require('zod')

// Create health assessment
const createAssessmentSchema = z.object({
    clientId: z.string().uuid().optional(),

    memberId: z.number().int().positive(),

    temperatureC: z.number()
        .min(30)
        .max(45)
        .nullable()
        .optional(),

    hasFever: z.boolean().optional(),

    hasCough: z.boolean().optional(),

    hasBreathingDifficulty: z.boolean().optional(),

    systolic: z.number()
        .int()
        .min(50)
        .max(260)
        .nullable()
        .optional(),

    diastolic: z.number()
        .int()
        .min(30)
        .max(160)
        .nullable()
        .optional(),

    notes: z.string().max(5000).nullable().optional(),

    flaggedForReview: z.boolean().optional(),
}).strict()

// List assessments
const listAssessmentsSchema = z.object({
    page: z.coerce.number().int().positive().default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    memberId: z.coerce.number().int().positive().optional(),

    householdId: z.coerce.number().int().positive().optional(),

    isUrgent: z.enum(['true', 'false'])
        .transform(value => value === 'true')
        .optional(),

    flaggedForReview: z.enum(['true', 'false'])
        .transform(value => value === 'true')
        .optional(),
})

// Assessment ID
const assessmentIdSchema = z.object({
    id: z.coerce.number().int().positive(),
}).strict()

// Update assessment
const updateAssessmentSchema = z.object({
    version: z.number().int().positive(),

    temperatureC: z.number()
        .min(30)
        .max(45)
        .nullable()
        .optional(),

    hasFever: z.boolean().optional(),

    hasCough: z.boolean().optional(),

    hasBreathingDifficulty: z.boolean().optional(),

    systolic: z.number()
        .int()
        .min(50)
        .max(260)
        .nullable()
        .optional(),

    diastolic: z.number()
        .int()
        .min(30)
        .max(160)
        .nullable()
        .optional(),

    notes: z.string().max(5000).nullable().optional(),

    flaggedForReview: z.boolean().optional(),
})
    .strict()
    .refine(
        data => Object.keys(data).some(key => key !== 'version'),
        { message: 'Provide at least one field to update' },
    )

// Delete assessment
const deleteAssessmentSchema = z.object({
    version: z.number().int().positive(),
}).strict()

module.exports = {
    createAssessmentSchema,
    listAssessmentsSchema,
    assessmentIdSchema,
    updateAssessmentSchema,
    deleteAssessmentSchema,
}
