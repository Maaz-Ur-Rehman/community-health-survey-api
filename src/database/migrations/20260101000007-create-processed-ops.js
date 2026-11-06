module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('processed_ops', {
            // UUID sent by the phone with every sync operation
            op_id: { type: Sequelize.STRING(36), primaryKey: true },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            entity: { type: Sequelize.STRING(30), allowNull: false },
            // the response we gave, replayed if the same op arrives again
            result: { type: Sequelize.JSONB, allowNull: false },
            created_at: { type: Sequelize.DATE, allowNull: false },
        })
        await queryInterface.addIndex('processed_ops', [
            'user_id',
            'created_at',
        ])
    },
    async down(queryInterface) {
        await queryInterface.dropTable('processed_ops')
    },
}
