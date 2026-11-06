module.exports = {
    async up(queryInterface) {
        const [existing] = await queryInterface.sequelize.query(
            "SELECT id FROM areas WHERE code = 'NORTH'",
        )
        if (existing.length) return

        const now = new Date()
        await queryInterface.bulkInsert('areas', [
            {
                code: 'NORTH',
                name: 'North District',
                created_at: now,
                updated_at: now,
            },
            {
                code: 'SOUTH',
                name: 'South District',
                created_at: now,
                updated_at: now,
            },
        ])
    },
    async down(queryInterface) {
        await queryInterface.bulkDelete('areas', { code: ['NORTH', 'SOUTH'] })
    },
}
