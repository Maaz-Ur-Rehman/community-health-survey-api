const { z } = require('zod')

const schema = z.object({
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z
        .string()
        .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
    SEED_ADMIN_EMAIL: z.string().email().default('admin@example.com'),
    SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin@12345'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
    // logger is not available yet, so this is the one allowed console use
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:')
    for (const issue of parsed.error.issues) {
        // eslint-disable-next-line no-console
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
}

const env = parsed.data
env.corsOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim())

module.exports = Object.freeze(env)
