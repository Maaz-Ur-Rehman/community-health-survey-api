module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('notifications', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            // unique: a job that runs twice cannot create a second record
            assessment_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                unique: true,
                references: { model: 'health_assessments', key: 'id' },
                onDelete: 'RESTRICT',
            },
            type: {
                type: Sequelize.STRING(30),
                allowNull: false,
                defaultValue: 'URGENT_ASSESSMENT',
            },
            message: { type: Sequelize.STRING(500), allowNull: false },
            read_at: { type: Sequelize.DATE },
            created_at: { type: Sequelize.DATE, allowNull: false },
            updated_at: { type: Sequelize.DATE, allowNull: false },
        })
        await queryInterface.addIndex('notifications', ['read_at'])
    },
    async down(queryInterface) {
        await queryInterface.dropTable('notifications')
    },
}
