const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')

const HealthAssessment = sequelize.define(
    'HealthAssessment',
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        clientId: {
            type: DataTypes.STRING(36),
            allowNull: false,
            unique: true,
        },
        memberId: { type: DataTypes.INTEGER, allowNull: false },
        temperatureC: {
            type: DataTypes.DECIMAL(4, 1),
            validate: { min: 30, max: 45 },
        },
        hasFever: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        hasCough: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        hasBreathingDifficulty: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        systolic: { type: DataTypes.SMALLINT, validate: { min: 50, max: 260 } },
        diastolic: {
            type: DataTypes.SMALLINT,
            validate: { min: 30, max: 160 },
        },
        notes: { type: DataTypes.TEXT },
        flaggedForReview: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        isUrgent: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        recordedBy: { type: DataTypes.INTEGER },
    },
    { tableName: 'health_assessments', paranoid: true },
)

module.exports = HealthAssessment
