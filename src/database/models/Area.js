const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')

const Area = sequelize.define(
    'Area',
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        code: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true,
            set(value) {
                this.setDataValue('code', String(value).trim().toUpperCase())
            },
        },
        name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
        description: { type: DataTypes.STRING(500) },
    },
    { tableName: 'areas' },
)

module.exports = Area
