
const { z } = require('zod')

// Create household member
const createMemberSchema = z.object({
    clientId: z.string().uuid().optional(),

    householdId: z.number().int().positive(),

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
}).strict()

// List members of a household
const listMembersSchema = z.object({
    householdId: z.coerce.number().int().positive(),

    page: z.coerce.number().int().positive().default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    search: z.string().trim().min(1).max(100).optional(),
})

// Validate member ID
const memberIdSchema = z.object({
    id: z.coerce.number().int().positive(),
}).strict()

// Update member information
const updateMemberSchema = z.object({
    version: z.number().int().positive(),

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
})
    .strict()
    .refine(
        data => Object.keys(data).some(key => key !== 'version'),
        { message: 'Provide at least one field to update' },
    )

// Delete member
const deleteMemberSchema = z.object({
    version: z.number().int().positive(),
}).strict()

module.exports = {
    createMemberSchema,
    listMembersSchema,
    memberIdSchema,
    updateMemberSchema,
    deleteMemberSchema,
}
