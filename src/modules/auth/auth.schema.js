const { z } = require('zod')

const loginSchema = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z.string().min(1).max(200),
})

const refreshSchema = z.object({
    refreshToken: z.string().min(20).max(200),
})

module.exports = { loginSchema, refreshSchema }
