const { z } = require('zod')

const createAreaSchema = z.object({
    code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9_-]{2,20}$/, 'Use 2-20 letters, digits, - or _'),
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).optional(),
})

module.exports = { createAreaSchema }
