const bcrypt = require('bcrypt')
const { Op } = require('sequelize')
const env = require('../../config/env')
const { sequelize, User, RefreshToken } = require('../../database/models')
const {
    UnauthorizedError,
    ForbiddenError,
} = require('../../common/errors/AppError')
const {
    signAccessToken,
    generateRefreshToken,
    hashToken,
} = require('../../common/utils/tokens')

// Used when the email does not exist, so the response time does not reveal
// whether an account exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12)

function toPublicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        areaId: user.areaId,
    }
}

async function issueTokens(user, transaction) {
    const refreshToken = generateRefreshToken()
    const expiresAt = new Date(
        Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    )
    await RefreshToken.create(
        { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt },
        { transaction },
    )
    return { accessToken: signAccessToken(user), refreshToken }
}

async function login({ email, password }) {
    const user = await User.scope('withPassword').findOne({ where: { email } })

    // async compare: bcrypt.compareSync would block the event loop
    const ok = await bcrypt.compare(
        password,
        user ? user.passwordHash : DUMMY_HASH,
    )
    if (!user || !ok) throw new UnauthorizedError('Invalid email or password')

    // only reveal account status after the password was verified
    if (!user.isActive) throw new ForbiddenError('This account is deactivated')

    const tokens = await issueTokens(user)
    return { ...tokens, user: toPublicUser(user) }
}

// Refresh-token rotation: every refresh revokes the old token and issues a
// new one. If an already-revoked token is presented again it was probably
// stolen, so every session of that user is revoked.
async function refresh(rawToken) {
    const stored = await RefreshToken.findOne({
        where: { tokenHash: hashToken(rawToken) },
    })
    if (!stored) throw new UnauthorizedError('Invalid refresh token')

    if (stored.revokedAt) {
        await RefreshToken.update(
            { revokedAt: new Date() },
            { where: { userId: stored.userId, revokedAt: { [Op.is]: null } } },
        )
        throw new UnauthorizedError('Refresh token was already used')
    }
    if (stored.expiresAt < new Date()) {
        throw new UnauthorizedError('Refresh token expired')
    }

    const user = await User.findByPk(stored.userId)
    if (!user || !user.isActive)
        throw new UnauthorizedError('Account is not active')

    return sequelize.transaction(async (transaction) => {
        // conditional update: if two requests race with the same token,
        // only one of them gets count = 1
        const [count] = await RefreshToken.update(
            { revokedAt: new Date() },
            {
                where: { id: stored.id, revokedAt: { [Op.is]: null } },
                transaction,
            },
        )
        if (count !== 1)
            throw new UnauthorizedError('Refresh token was already used')

        const tokens = await issueTokens(user, transaction)
        return { ...tokens, user: toPublicUser(user) }
    })
}

// Idempotent: logging out twice, or with an unknown token, is not an error.
async function logout(rawToken) {
    await RefreshToken.update(
        { revokedAt: new Date() },
        {
            where: {
                tokenHash: hashToken(rawToken),
                revokedAt: { [Op.is]: null },
            },
        },
    )
}

module.exports = { login, refresh, logout, toPublicUser }
