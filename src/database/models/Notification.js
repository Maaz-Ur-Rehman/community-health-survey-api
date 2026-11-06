const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')

const Notification = sequelize.define(
    'Notification',
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        assessmentId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
        },
        type: {
            type: DataTypes.STRING(30),
            allowNull: false,
            defaultValue: 'URGENT_ASSESSMENT',
        },
        message: { type: DataTypes.STRING(500), allowNull: false },
        readAt: { type: DataTypes.DATE },
    },
    { tableName: 'notifications' },
)

module.exports = Notification
