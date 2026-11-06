
const { z } = require('zod')

const listNotificationsSchema = z.object({
    page: z.coerce.number().int().positive().default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    unreadOnly: z.enum(['true', 'false'])
        .transform(value => value === 'true')
        .optional(),
}).strict()

const notificationIdSchema = z.object({
    id: z.coerce.number().int().positive(),
}).strict()

module.exports = {
    listNotificationsSchema,
    notificationIdSchema,
}
