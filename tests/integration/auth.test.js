const request = require('supertest')
const {
    RefreshToken,
    User,
    Area,
    sequelize,
} = require('../../src/database/models')
const redis = require('../../src/config/redis')
const {
    app,
    createUser,
    createArea,
    login,
    loginAsAdmin,
} = require('../helpers')

const createdUserIds = []
const createdAreaIds = []

afterAll(async () => {
    await User.destroy({ where: { id: createdUserIds } }) // refresh tokens cascade
    await Area.destroy({ where: { id: createdAreaIds } })
    await sequelize.close()
    redis.disconnect()
})

async function newWorker(overrides) {
    const user = await createUser(overrides)
    createdUserIds.push(user.id)
    return user
}

describe('login', () => {
    it('returns tokens and a public user, never the password hash', async () => {
        const user = await newWorker()
        const res = await login(user.email)

        expect(res.status).toBe(200)
        expect(res.body.data.accessToken).toEqual(expect.any(String))
        expect(res.body.data.refreshToken).toEqual(expect.any(String))
        expect(res.body.data.user).toMatchObject({
            id: user.id,
            role: 'FIELD_WORKER',
        })
        expect(JSON.stringify(res.body)).not.toMatch(
            /passwordHash|password_hash/,
        )
    })

    it('rejects a wrong password and an unknown email with the same 401', async () => {
        const user = await newWorker()
        const wrong = await login(user.email, 'bad-password')
        const unknown = await login('nobody@example.com', 'whatever')

        expect(wrong.status).toBe(401)
        expect(unknown.status).toBe(401)
        expect(wrong.body.error.message).toBe(unknown.body.error.message)
    })

    it('blocks a deactivated account with 403', async () => {
        const user = await newWorker({ isActive: false })
        const res = await login(user.email)
        expect(res.status).toBe(403)
    })

    it('validates the request body', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'not-an-email' })
        expect(res.status).toBe(400)
        expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })
})

describe('protected endpoints', () => {
    it('returns 401 without a token', async () => {
        const res = await request(app).get('/api/v1/auth/me')
        expect(res.status).toBe(401)
    })

    it('returns 401 for a garbage token', async () => {
        const res = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', 'Bearer abc.def.ghi')
        expect(res.status).toBe(401)
    })

    it('rejects the access token of a user deactivated after login', async () => {
        const user = await newWorker()
        const { body } = await login(user.email)
        await user.update({ isActive: false })

        const res = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${body.data.accessToken}`)
        expect(res.status).toBe(401)
    })
})

describe('authorization (role checks are enforced by the backend)', () => {
    it('forbids a field worker from calling admin endpoints directly', async () => {
        const user = await newWorker()
        const { body } = await login(user.email)
        const auth = { Authorization: `Bearer ${body.data.accessToken}` }

        const list = await request(app).get('/api/v1/areas').set(auth)
        const create = await request(app)
            .post('/api/v1/areas')
            .set(auth)
            .send({ code: 'HACK', name: 'Hacked Area' })

        expect(list.status).toBe(403)
        expect(create.status).toBe(403)
        expect(await Area.count({ where: { code: 'HACK' } })).toBe(0)
    })

    it('lets a super admin create and list areas', async () => {
        const admin = await loginAsAdmin()
        const auth = { Authorization: `Bearer ${admin.accessToken}` }
        const code = `A${Date.now()}`.slice(0, 20)

        const created = await request(app)
            .post('/api/v1/areas')
            .set(auth)
            .send({ code, name: `Admin Area ${code}` })
        expect(created.status).toBe(201)
        createdAreaIds.push(created.body.data.id)

        const list = await request(app).get('/api/v1/areas').set(auth)
        expect(list.status).toBe(200)
        expect(list.body.data.some((a) => a.code === code.toUpperCase())).toBe(
            true,
        )

        const dup = await request(app)
            .post('/api/v1/areas')
            .set(auth)
            .send({ code: `${code}X`.slice(0, 20), name: `Admin Area ${code}` })
        expect(dup.status).toBe(409)
    })

    it('shows a field worker only their assigned area', async () => {
        const area = await createArea()
        createdAreaIds.push(area.id)
        const user = await newWorker({ areaId: area.id })
        const { body } = await login(user.email)

        const res = await request(app)
            .get('/api/v1/areas/me')
            .set('Authorization', `Bearer ${body.data.accessToken}`)
        expect(res.status).toBe(200)
        expect(res.body.data.id).toBe(area.id)
    })
})

describe('refresh tokens and logout', () => {
    it('rotates the refresh token on every use', async () => {
        const user = await newWorker()
        const first = (await login(user.email)).body.data

        const res = await request(app)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken: first.refreshToken })
        expect(res.status).toBe(200)
        expect(res.body.data.refreshToken).not.toBe(first.refreshToken)
    })

    it('treats reuse of an old refresh token as theft and revokes the session', async () => {
        const user = await newWorker()
        const first = (await login(user.email)).body.data
        const second = (
            await request(app)
                .post('/api/v1/auth/refresh')
                .send({ refreshToken: first.refreshToken })
        ).body.data

        const reuse = await request(app)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken: first.refreshToken })
        expect(reuse.status).toBe(401)

        // the newer token was revoked too
        const after = await request(app)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken: second.refreshToken })
        expect(after.status).toBe(401)
    })

    it('logout revokes the refresh token, and logging out twice is fine', async () => {
        const user = await newWorker()
        const { refreshToken } = (await login(user.email)).body.data

        const out1 = await request(app)
            .post('/api/v1/auth/logout')
            .send({ refreshToken })
        const out2 = await request(app)
            .post('/api/v1/auth/logout')
            .send({ refreshToken })
        expect(out1.status).toBe(204)
        expect(out2.status).toBe(204)

        const res = await request(app)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken })
        expect(res.status).toBe(401)
    })

    it('rejects an expired refresh token', async () => {
        const user = await newWorker()
        const { refreshToken } = (await login(user.email)).body.data
        await RefreshToken.update(
            { expiresAt: new Date(Date.now() - 1000) },
            { where: { userId: user.id } },
        )

        const res = await request(app)
            .post('/api/v1/auth/refresh')
            .send({ refreshToken })
        expect(res.status).toBe(401)
    })
})
