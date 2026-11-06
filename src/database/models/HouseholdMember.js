const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')

const GENDERS = ['MALE', 'FEMALE', 'OTHER']
const RELATIONSHIPS = ['HEAD', 'SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER']

const HouseholdMember = sequelize.define(
    'HouseholdMember',
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        clientId: {
            type: DataTypes.STRING(36),
            allowNull: false,
            unique: true,
        },
        householdId: { type: DataTypes.INTEGER, allowNull: false },
        name: { type: DataTypes.STRING(100), allowNull: false },
        age: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            validate: { min: 0, max: 120 },
        },
        gender: {
            type: DataTypes.STRING(10),
            allowNull: false,
            validate: { isIn: [GENDERS] },
        },
        relationship: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: { isIn: [RELATIONSHIPS] },
        },
        version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        createdBy: { type: DataTypes.INTEGER },
    },
    { tableName: 'household_members', paranoid: true },
)

HouseholdMember.GENDERS = GENDERS
HouseholdMember.RELATIONSHIPS = RELATIONSHIPS

module.exports = HouseholdMember
