const { DataTypes } = require('sequelize')
const sequelize = require('../../config/database')

const User = sequelize.define(
    'User',
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING(100), allowNull: false },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            set(value) {
                this.setDataValue('email', String(value).trim().toLowerCase())
            },
        },
        passwordHash: { type: DataTypes.STRING(255), allowNull: false },
        role: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: { isIn: [['SUPER_ADMIN', 'FIELD_WORKER']] },
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        areaId: { type: DataTypes.INTEGER },
    },
    {
        tableName: 'users',
        // never leak the hash in an API response by accident
        defaultScope: { attributes: { exclude: ['passwordHash'] } },
        scopes: { withPassword: { attributes: { include: ['passwordHash'] } } },
    },
)

module.exports = User
