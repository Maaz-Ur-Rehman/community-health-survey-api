
const { z } = require('zod')

const emailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .max(255)
    .pipe(z.email())

// Create field worker
const createWorkerSchema = z.object({
    name: z.string().trim().min(1).max(100),
    email: emailSchema,
    password: z.string().min(8).max(200),
    areaId: z.number().int().positive().nullable().optional(),
}).strict()

// Get workers with pagination and filters
const listWorkersSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    areaId: z.coerce.number().int().positive().optional(),
    isActive: z.enum(['true', 'false'])
        .transform(value => value === 'true')
        .optional(),
})

// Validate worker ID
const userIdSchema = z.object({
    id: z.coerce.number().int().positive(),
}).strict()

// Update worker information
const updateWorkerSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    email: emailSchema.optional(),
})
    .strict()
    .refine(data => Object.keys(data).length > 0, {
        message: 'Provide at least one field to update',
    })

// Activate / deactivate worker
const workerStatusSchema = z.object({
    isActive: z.boolean(),
}).strict()

// Assign or remove area
const assignAreaSchema = z.object({
    areaId: z.number().int().positive().nullable(),
}).strict()

module.exports = {
    createWorkerSchema,
    listWorkersSchema,
    userIdSchema,
    updateWorkerSchema,
    workerStatusSchema,
    assignAreaSchema,
}
