const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')

const ProcessedOp = sequelize.define(
    'ProcessedOp',
    {
        opId: { type: DataTypes.STRING(36), primaryKey: true },
        userId: { type: DataTypes.INTEGER, allowNull: false },
        entity: { type: DataTypes.STRING(30), allowNull: false },
        result: { type: DataTypes.JSONB, allowNull: false },
    },
    { tableName: 'processed_ops', updatedAt: false },
)

module.exports = ProcessedOp
