module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('household_members', {
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
            household_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'households', key: 'id' },
                onDelete: 'RESTRICT',
            },
            name: { type: Sequelize.STRING(100), allowNull: false },
            age: { type: Sequelize.SMALLINT, allowNull: false },
            gender: { type: Sequelize.STRING(10), allowNull: false },
            relationship: { type: Sequelize.STRING(20), allowNull: false },
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
        await queryInterface.addIndex('household_members', ['household_id'])
        await queryInterface.addIndex('household_members', ['updated_at', 'id'])
        await queryInterface.sequelize.query(
            `ALTER TABLE household_members
             ADD CONSTRAINT members_age_check CHECK (age BETWEEN 0 AND 120),
             ADD CONSTRAINT members_gender_check
               CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
             ADD CONSTRAINT members_relationship_check
               CHECK (relationship IN
                 ('HEAD', 'SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER'))`,
        )
    },
    async down(queryInterface) {
        await queryInterface.dropTable('household_members')
    },
}
