
const { z } = require('zod')

// Create household
const createHouseholdSchema = z.object({
    clientId: z.string().uuid().optional(),

    householdCode: z.string().trim().min(1).max(40),

    address: z.string().trim().min(1).max(255),

    areaId: z.number().int().positive().optional(),

    latitude: z.number().min(-90).max(90).nullable().optional(),

    longitude: z.number().min(-180).max(180).nullable().optional(),
}).strict()

// List households
const listHouseholdsSchema = z.object({
    page: z.coerce.number().int().positive().default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    search: z.string().trim().min(1).max(100).optional(),

    areaId: z.coerce.number().int().positive().optional(),
})

// Validate household ID
const householdIdSchema = z.object({
    id: z.coerce.number().int().positive(),
}).strict()

// Update household
const updateHouseholdSchema = z.object({
    version: z.number().int().positive(),

    householdCode: z.string().trim().min(1).max(40).optional(),

    address: z.string().trim().min(1).max(255).optional(),

    areaId: z.number().int().positive().optional(),

    latitude: z.number().min(-90).max(90).nullable().optional(),

    longitude: z.number().min(-180).max(180).nullable().optional(),
})
    .strict()
    .refine(
        data => Object.keys(data).some(key => key !== 'version'),
        { message: 'Provide at least one field to update' },
    )

// Delete household
const deleteHouseholdSchema = z.object({
    version: z.number().int().positive(),
}).strict()

module.exports = {
    createHouseholdSchema,
    listHouseholdsSchema,
    householdIdSchema,
    updateHouseholdSchema,
    deleteHouseholdSchema,
}
