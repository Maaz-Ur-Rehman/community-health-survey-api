module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('households', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            // Random id generated on the phone. Makes "create" idempotent.
            client_id: {
                type: Sequelize.STRING(36),
                allowNull: false,
                unique: true,
            },
            household_code: { type: Sequelize.STRING(40), allowNull: false },
            area_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'areas', key: 'id' },
                onDelete: 'RESTRICT',
            },
            address: { type: Sequelize.STRING(255), allowNull: false },
            latitude: { type: Sequelize.DECIMAL(9, 6) },
            longitude: { type: Sequelize.DECIMAL(9, 6) },
            version: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 1,
            },
            created_by: {
                type: Sequelize.INTEGER,
                references: { model: 'users', key: 'id' },
                onDelete: 'SET NULL',
            },
            created_at: { type: Sequelize.DATE, allowNull: false },
            updated_at: { type: Sequelize.DATE, allowNull: false },
            deleted_at: { type: Sequelize.DATE },
        })
        await queryInterface.addIndex('households', ['area_id'])
        await queryInterface.addIndex('households', ['updated_at', 'id'])
        // Uniqueness applies to live rows only, so a deleted household
        // does not block its code forever.
        await queryInterface.addIndex('households', ['household_code'], {
            unique: true,
            name: 'households_household_code_live_uq',
            where: { deleted_at: null },
        })
        await queryInterface.sequelize.query(
            `ALTER TABLE households
             ADD CONSTRAINT households_lat_check
               CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
             ADD CONSTRAINT households_lng_check
               CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)`,
        )
    },
    async down(queryInterface) {
        await queryInterface.dropTable('households')
    },
}
