module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('refresh_tokens', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            // SHA-256 hex of the token. The raw token is never stored.
            token_hash: {
                type: Sequelize.STRING(64),
                allowNull: false,
                unique: true,
            },
            expires_at: { type: Sequelize.DATE, allowNull: false },
            revoked_at: { type: Sequelize.DATE },
            created_at: { type: Sequelize.DATE, allowNull: false },
            updated_at: { type: Sequelize.DATE, allowNull: false },
        })
        await queryInterface.addIndex('refresh_tokens', ['user_id'])
    },
    async down(queryInterface) {
        await queryInterface.dropTable('refresh_tokens')
    },
}
