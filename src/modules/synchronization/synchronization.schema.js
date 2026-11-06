
const { z } = require('zod')

const uuid = z.string().uuid()

const common = {
    opId: uuid,
    clientId: uuid,
}

// ---------------- HOUSEHOLD ----------------

const householdCreate = z.object({
    ...common,
    entity: z.literal('HOUSEHOLD'),
    action: z.literal('CREATE'),
    data: z.object({
        householdCode: z.string().trim().min(1).max(40),
        address: z.string().trim().min(1).max(255),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
    }).strict(),
}).strict()

const householdUpdate = z.object({
    ...common,
    entity: z.literal('HOUSEHOLD'),
    action: z.literal('UPDATE'),
    baseVersion: z.number().int().positive(),
    data: z.object({
        address: z.string().trim().min(1).max(255).optional(),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
    }).strict().refine(data => Object.keys(data).length > 0),
}).strict()

// ---------------- HOUSEHOLD MEMBER ----------------

const memberCreate = z.object({
    ...common,
    entity: z.literal('HOUSEHOLD_MEMBER'),
    action: z.literal('CREATE'),
    data: z.object({
        householdClientId: uuid,
        name: z.string().trim().min(1).max(100),
        age: z.number().int().min(0).max(120),
        gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
        relationship: z.enum([
            'HEAD',
            'SPOUSE',
            'CHILD',
            'PARENT',
            'SIBLING',
            'OTHER',
        ]),
    }).strict(),
}).strict()

const memberUpdate = z.object({
    ...common,
    entity: z.literal('HOUSEHOLD_MEMBER'),
    action: z.literal('UPDATE'),
    baseVersion: z.number().int().positive(),
    data: z.object({
        name: z.string().trim().min(1).max(100).optional(),
        age: z.number().int().min(0).max(120).optional(),
        gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
        relationship: z.enum([
            'HEAD',
            'SPOUSE',
            'CHILD',
            'PARENT',
            'SIBLING',
            'OTHER',
        ]).optional(),
    }).strict().refine(data => Object.keys(data).length > 0),
}).strict()

// ---------------- HEALTH ASSESSMENT ----------------

const assessmentFields = {
    temperatureC: z.number().min(30).max(45).nullable().optional(),
    hasFever: z.boolean().optional(),
    hasCough: z.boolean().optional(),
    hasBreathingDifficulty: z.boolean().optional(),
    systolic: z.number().int().min(50).max(260).nullable().optional(),
    diastolic: z.number().int().min(30).max(160).nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    flaggedForReview: z.boolean().optional(),
}

const assessmentCreate = z.object({
    ...common,
    entity: z.literal('HEALTH_ASSESSMENT'),
    action: z.literal('CREATE'),
    data: z.object({
        memberClientId: uuid,
        ...assessmentFields,
    }).strict(),
}).strict()

const assessmentUpdate = z.object({
    ...common,
    entity: z.literal('HEALTH_ASSESSMENT'),
    action: z.literal('UPDATE'),
    baseVersion: z.number().int().positive(),
    data: z.object(assessmentFields)
        .strict()
        .refine(data => Object.keys(data).length > 0),
}).strict()

// ---------------- DELETE OPERATIONS ----------------

const deleteSchema = (entity) =>
    z.object({
        ...common,
        entity: z.literal(entity),
        action: z.literal('DELETE'),
        baseVersion: z.number().int().positive(),
    }).strict()

const syncOperationSchema = z.union([
    householdCreate,
    householdUpdate,
    deleteSchema('HOUSEHOLD'),

    memberCreate,
    memberUpdate,
    deleteSchema('HOUSEHOLD_MEMBER'),

    assessmentCreate,
    assessmentUpdate,
    deleteSchema('HEALTH_ASSESSMENT'),
])

// ---------------- PUSH REQUEST ----------------

const pushSchema = z.object({
    operations: z.array(syncOperationSchema)
        .min(1)
        .max(100),
}).strict()

// ---------------- PULL REQUEST ----------------

const pullSchema = z.object({
    cursor: z.string().min(1).max(1000).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
}).strict()

module.exports = {
    pushSchema,
    pullSchema,
}
