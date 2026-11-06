module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('areas', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            code: {
                type: Sequelize.STRING(20),
                allowNull: false,
                unique: true,
            },
            name: {
                type: Sequelize.STRING(100),
                allowNull: false,
                unique: true,
            },
            description: { type: Sequelize.STRING(500) },
            created_at: { type: Sequelize.DATE, allowNull: false },
            updated_at: { type: Sequelize.DATE, allowNull: false },
        })
    },
    async down(queryInterface) {
        await queryInterface.dropTable('areas')
    },
}
