module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('users', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            name: { type: Sequelize.STRING(100), allowNull: false },
            email: {
                type: Sequelize.STRING(255),
                allowNull: false,
                unique: true,
            },
            password_hash: { type: Sequelize.STRING(255), allowNull: false },
            role: { type: Sequelize.STRING(20), allowNull: false },
            is_active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            area_id: {
                type: Sequelize.INTEGER,
                references: { model: 'areas', key: 'id' },
                onDelete: 'SET NULL',
            },
            created_at: { type: Sequelize.DATE, allowNull: false },
            updated_at: { type: Sequelize.DATE, allowNull: false },
        })
        await queryInterface.addIndex('users', ['area_id'])
        await queryInterface.sequelize.query(
            `ALTER TABLE users ADD CONSTRAINT users_role_check
             CHECK (role IN ('SUPER_ADMIN', 'FIELD_WORKER'))`,
        )
    },
    async down(queryInterface) {
        await queryInterface.dropTable('users')
    },
}
