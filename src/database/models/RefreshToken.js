const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')

const RefreshToken = sequelize.define(
    'RefreshToken',
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: DataTypes.INTEGER, allowNull: false },
        tokenHash: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true,
        },
        expiresAt: { type: DataTypes.DATE, allowNull: false },
        revokedAt: { type: DataTypes.DATE },
    },
    { tableName: 'refresh_tokens' },
)

module.exports = RefreshToken
