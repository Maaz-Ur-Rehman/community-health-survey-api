const bcrypt = require('bcrypt')
const env = require('../../config/env')

module.exports = {
    async up(queryInterface) {
        const email = env.SEED_ADMIN_EMAIL.toLowerCase()
        const [existing] = await queryInterface.sequelize.query(
            'SELECT id FROM users WHERE email = :email',
            { replacements: { email } },
        )
        if (existing.length) return

        const now = new Date()
        await queryInterface.bulkInsert('users', [
            {
                name: 'Super Admin',
                email,
                password_hash: await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12),
                role: 'SUPER_ADMIN',
                is_active: true,
                created_at: now,
                updated_at: now,
            },
        ])
    },
    async down(queryInterface) {
        await queryInterface.bulkDelete('users', { role: 'SUPER_ADMIN' })
    },
}
