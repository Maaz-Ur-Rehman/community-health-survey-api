module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('health_assessments', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            client_id: {
                type: Sequelize.STRING(36),
                allowNull: false,
                unique: true,
            },
            member_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'household_members', key: 'id' },
                onDelete: 'RESTRICT',
            },
            temperature_c: { type: Sequelize.DECIMAL(4, 1) },
            has_fever: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            has_cough: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            has_breathing_difficulty: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            systolic: { type: Sequelize.SMALLINT },
            diastolic: { type: Sequelize.SMALLINT },
            notes: { type: Sequelize.TEXT },
            // set manually by the field worker
            flagged_for_review: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            // computed on the server (see assessments service)
            is_urgent: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            version: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 1,
            },
            recorded_by: {
                type: Sequelize.INTEGER,
                references: { model: 'users', key: 'id' },
                onDelete: 'SET NULL',
            },
            created_at: { type: Sequelize.DATE, allowNull: false },
            updated_at: { type: Sequelize.DATE, allowNull: false },
            deleted_at: { type: Sequelize.DATE },
        })
        await queryInterface.addIndex('health_assessments', ['member_id'])
        await queryInterface.addIndex('health_assessments', [
            'updated_at',
            'id',
        ])
        await queryInterface.addIndex('health_assessments', ['is_urgent'])
        await queryInterface.sequelize.query(
            `ALTER TABLE health_assessments
             ADD CONSTRAINT assessments_temp_check
               CHECK (temperature_c IS NULL OR temperature_c BETWEEN 30 AND 45),
             ADD CONSTRAINT assessments_systolic_check
               CHECK (systolic IS NULL OR systolic BETWEEN 50 AND 260),
             ADD CONSTRAINT assessments_diastolic_check
               CHECK (diastolic IS NULL OR diastolic BETWEEN 30 AND 160)`,
        )
    },
    async down(queryInterface) {
        await queryInterface.dropTable('health_assessments')
    },
}
