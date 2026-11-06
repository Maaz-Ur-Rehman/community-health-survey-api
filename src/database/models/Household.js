const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')

const Household = sequelize.define(
    'Household',
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        clientId: {
            type: DataTypes.STRING(36),
            allowNull: false,
            unique: true,
        },
        householdCode: { type: DataTypes.STRING(40), allowNull: false },
        areaId: { type: DataTypes.INTEGER, allowNull: false },
        address: { type: DataTypes.STRING(255), allowNull: false },
        latitude: { type: DataTypes.DECIMAL(9, 6) },
        longitude: { type: DataTypes.DECIMAL(9, 6) },
        // incremented by the service on every update (conflict detection)
        version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        createdBy: { type: DataTypes.INTEGER },
    },
    {
        tableName: 'households',
        paranoid: true, // soft delete -> deleted_at is the tombstone
    },
)

module.exports = Household
