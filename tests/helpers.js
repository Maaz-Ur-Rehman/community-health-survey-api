const bcrypt = require('bcrypt')
const request = require('supertest')
const app = require('../src/app')
const { User, Area } = require('../src/database/models')

const PASSWORD = 'Worker@12345'
let counter = 0

// Creates a user directly in the database (not through the API).
async function createUser(overrides = {}) {
    counter += 1
    return User.create({
        name: 'Test User',
        email: `test-${Date.now()}-${counter}@example.com`,
        passwordHash: await bcrypt.hash(PASSWORD, 4), // low cost = fast tests
        role: 'FIELD_WORKER',
        isActive: true,
        ...overrides,
    })
}

async function login(email, password = PASSWORD) {
    return request(app).post('/api/v1/auth/login').send({ email, password })
}

async function loginAsAdmin() {
    const res = await login(
        process.env.SEED_ADMIN_EMAIL,
        process.env.SEED_ADMIN_PASSWORD,
    )
    return res.body.data
}

async function createArea(overrides = {}) {
    counter += 1
    return Area.create({
        code: `T${Date.now()}${counter}`.slice(0, 20),
        name: `Test Area ${Date.now()}-${counter}`,
        ...overrides,
    })
}

module.exports = { app, PASSWORD, createUser, createArea, login, loginAsAdmin }
