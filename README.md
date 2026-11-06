# Community Health Field Survey API

Backend API for the Community Health Field Survey application. The system supports administrators managing field workers and household health data, while field workers use a mobile application to collect information, including when offline.

> **Implementation status:** This README documents the API modules shared and implemented so far. Dashboard endpoints, Redis dashboard caching, the complete BullMQ worker, and automated test coverage are still planned work and are not described as completed features.

## Contents

- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Requirements](#requirements)
- [Environment configuration](#environment-configuration)
- [Installation and running](#installation-and-running)
- [Authentication](#authentication)
- [Roles and permissions](#roles-and-permissions)
- [API reference](#api-reference)
  - [Health check](#health-check)
  - [Authentication](#authentication-api)
  - [Areas](#areas)
  - [Users / field workers](#users--field-workers)
  - [Households](#households)
  - [Household members](#household-members)
  - [Health assessments](#health-assessments)
  - [Synchronization](#synchronization)
  - [Notifications](#notifications)
- [Synchronization contract](#synchronization-contract)
- [Error responses](#error-responses)
- [Database and data model](#database-and-data-model)
- [Seeded administrator](#seeded-administrator)
- [Background processing](#background-processing)
- [Caching](#caching)
- [Testing](#testing)
- [Known limitations and next steps](#known-limitations-and-next-steps)

---

## Technology stack

| Area | Technology |
|---|---|
| Language | JavaScript (CommonJS) |
| Runtime | Node.js 22 or later |
| HTTP framework | Express 5 |
| Database | PostgreSQL |
| ORM | Sequelize 6 |
| Request validation | Zod |
| Authentication | JWT access tokens + opaque refresh tokens |
| Password hashing | bcrypt |
| Redis client | ioredis |
| Background queue | BullMQ |
| Logging | Pino + pino-http |
| Security middleware | Helmet, CORS, express-rate-limit |
| Tests | Jest + Supertest (test coverage is still being added) |

## Architecture

The backend follows a modular Express architecture. Each feature module separates routing, request validation, actions/controllers, and business logic/services.

- **Routes** mount feature modules under `/api/v1`.
- **Routing files** define HTTP methods, authentication, authorization, and validation middleware.
- **Action files** read validated request data, call a service, and return an HTTP response.
- **Service files** contain business rules and Sequelize queries/transactions.
- **Models** define PostgreSQL tables and associations.
- **Common middleware** handles authentication, authorization, validation, not-found responses, and errors.

The Expo mobile application is expected to persist offline data locally (for example, with Expo SQLite) and use the synchronization endpoints when connectivity returns. The React.js admin dashboard uses the administrative APIs.

## Project structure

The relevant backend structure is expected to look similar to this:

```text
backend/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   ├── env.js
│   │   ├── redis.js
│   │   └── sequelize-cli.js
│   ├── database/
│   │   ├── models/
│   │   ├── migrations/
│   │   └── seeders/
│   ├── common/
│   │   ├── errors/
│   │   ├── middleware/
│   │   └── utils/
│   ├── modules/
│   │   ├── auth/
│   │   ├── areas/
│   │   ├── users/
│   │   ├── households/
│   │   ├── household-members/
│   │   ├── health-assessments/
│   │   ├── synchronization/
│   │   └── notifications/
│   ├── queues/
│   ├── app.js
│   ├── routes.js
│   ├── server.js
│   └── worker.js
├── .env
├── .env.example
├── .sequelizerc
└── package.json
```

Adjust paths in `.sequelizerc` if your migration or seeder directories are located elsewhere.

## Requirements

- Node.js 22 or later
- npm
- PostgreSQL (version 14 or later is suitable)
- Redis

## Environment configuration

Create a `.env` file in the backend root. Example:

```env
NODE_ENV=development
PORT=4000

DATABASE_URL=postgres://postgres:YOUR_DB_PASSWORD@localhost:5432/field_health_survey
REDIS_URL=redis://127.0.0.1:6379

JWT_ACCESS_SECRET=replace_with_a_random_secret_at_least_32_characters
JWT_ACCESS_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30

CORS_ORIGINS=http://localhost:5173

SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=replace_with_a_strong_local_password
```

The environment module validates these values with Zod. `DATABASE_URL`, `REDIS_URL`, and `JWT_ACCESS_SECRET` are required. The access-token secret must contain at least 32 characters.

`CORS_ORIGINS` accepts comma-separated origins, for example:

```env
CORS_ORIGINS=http://localhost:5173,http://localhost:19006
```

Do not commit `.env` or production secrets. Change the example administrator password before seeding any non-disposable environment. The defaults in `env.js` are development conveniences, not production credentials.

## Installation and running

### 1. Install dependencies

```bash
npm install
```

### 2. Create PostgreSQL database and start Redis

Create the database named in `DATABASE_URL` and make sure PostgreSQL and Redis are running.

### 3. Configure Sequelize CLI paths

If not already present, add a `.sequelizerc` file at the backend root so Sequelize CLI can find the configuration, migrations, models, and seeders. Update the paths if your project differs:

```javascript
const path = require('path')

module.exports = {
    config: path.resolve(__dirname, 'src/config/sequelize-cli.js'),
    'models-path': path.resolve(__dirname, 'src/database/models'),
    'seeders-path': path.resolve(__dirname, 'src/database/seeders'),
    'migrations-path': path.resolve(__dirname, 'src/database/migrations'),
}
```

### 4. Run migrations and seeders

With the `.sequelizerc` paths configured:

```bash
node --env-file=.env node_modules/sequelize-cli/lib/sequelize db:migrate
node --env-file=.env node_modules/sequelize-cli/lib/sequelize db:seed:all
```

If your npm scripts already invoke these commands and your `.sequelizerc` is configured, you can use:

```bash
npm run migrate
npm run seed
```

### 5. Start the API

The application entry point shared for this project is `src/server.js`. Start it directly with:

```bash
node --env-file=.env src/server.js
```

Development mode:

```bash
node --watch --env-file=.env src/server.js
```

Make sure the `start` and `dev` scripts in `package.json` point to `src/server.js` if you prefer `npm start` and `npm run dev`. The original scripts shared during setup referenced root-level `index.js`.

The API base URL for local development is:

```text
http://localhost:4000/api/v1
```

### 6. Health check

```http
GET http://localhost:4000/health
```

The health endpoint checks PostgreSQL and Redis connectivity.

---

## Authentication

Authentication is handled by the backend using JWT access tokens and opaque refresh tokens.

- Access tokens are signed using HS256 and expire after `JWT_ACCESS_TTL` (default `15m`).
- Refresh tokens are random opaque tokens. Only their SHA-256 hashes are stored in PostgreSQL.
- Refresh requests rotate the token: the old token is revoked and a new token is issued.
- Logout revokes the submitted refresh token.
- The authentication middleware verifies the JWT and loads the current user from PostgreSQL. Deactivated users are denied access even if their access token has not expired.
- A logged-out access token remains usable until its expiration unless the account is deactivated. This is the current JWT trade-off.

For protected endpoints, send:

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

### Get a Super Admin token

Use the seeded administrator credentials described in [Seeded administrator](#seeded-administrator), then call `POST /auth/login`.

### Get a Field Worker token

1. Log in as Super Admin.
2. Create a field worker using `POST /users` and assign an area.
3. Log in using the field worker's email and password with `POST /auth/login`.
4. Use the returned `accessToken` for field-worker endpoints and synchronization.

---

## Roles and permissions

The backend roles are:

- `SUPER_ADMIN`: administrative APIs and cross-area access.
- `FIELD_WORKER`: mobile field-work APIs, restricted to the worker's assigned area.

Permissions are enforced by backend middleware and service-level ownership/area checks. Hiding a screen in the frontend is not an authorization mechanism.

| Module | Super Admin | Field Worker |
|---|---|---|
| Authentication | Login / refresh / logout / own profile | Login / refresh / logout / own profile |
| Areas | List and create | View assigned area (`/areas/me`) |
| Users | Manage field workers | No access |
| Households | All areas | Assigned area only |
| Household members | All accessible households | Members in assigned area only |
| Health assessments | All areas | Assessments in assigned area only |
| Synchronization | No access to the field-worker sync routes | Push and pull own assigned-area data |
| Notifications | View and manage notifications | No access |

---

# API reference

All endpoints below are mounted under:

```text
http://localhost:4000/api/v1
```

Unless otherwise stated, protected endpoints require a Bearer access token.

## Health check

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| GET | `/health` | No | Checks PostgreSQL and Redis connectivity. This route is mounted outside `/api/v1`. |

Example response:

```json
{
  "status": "ok",
  "checks": {
    "database": "up",
    "redis": "up"
  }
}
```

## Authentication API

### 1. Login

```http
POST /auth/login
```

Public endpoint. Login is rate-limited.

Request:

```json
{
  "email": "admin@example.com",
  "password": "YOUR_PASSWORD"
}
```

Response (`200`):

```json
{
  "data": {
    "accessToken": "JWT_ACCESS_TOKEN",
    "refreshToken": "OPAQUE_REFRESH_TOKEN",
    "user": {
      "id": 1,
      "name": "Super Admin",
      "email": "admin@example.com",
      "role": "SUPER_ADMIN",
      "areaId": null
    }
  }
}
```

### 2. Refresh access token

```http
POST /auth/refresh
```

Public endpoint; requires a valid refresh token. The submitted refresh token is rotated.

Request:

```json
{
  "refreshToken": "OPAQUE_REFRESH_TOKEN"
}
```

Response (`200`): same shape as login, containing a new access token and refresh token.

### 3. Logout

```http
POST /auth/logout
```

Request:

```json
{
  "refreshToken": "OPAQUE_REFRESH_TOKEN"
}
```

Response: `204 No Content`.

Logout is idempotent. It revokes the matching, still-active refresh token if it exists.

### 4. Current user

```http
GET /auth/me
```

Requires authentication.

Response (`200`):

```json
{
  "data": {
    "id": 2,
    "name": "Ali Khan",
    "email": "ali@example.com",
    "role": "FIELD_WORKER",
    "areaId": 1
  }
}
```

## Areas

### 1. List areas

```http
GET /areas
```

Permission: `SUPER_ADMIN`.

Returns areas ordered by name.

### 2. Create area

```http
POST /areas
```

Permission: `SUPER_ADMIN`.

Request fields are based on the Area model:

```json
{
  "code": "NORTH",
  "name": "North District",
  "description": "Northern service area"
}
```

`code` is normalized to uppercase. Area codes and names must be unique.

### 3. Get my assigned area

```http
GET /areas/me
```

Permission: `FIELD_WORKER`.

Returns the field worker's assigned area, or `null` if no area is assigned.

## Users / field workers

All user-management endpoints require `SUPER_ADMIN`. The create endpoint always creates a `FIELD_WORKER`; public/admin account creation through this endpoint is not supported.

### 1. Create field worker

```http
POST /users
```

Request:

```json
{
  "name": "Ali Khan",
  "email": "ali@example.com",
  "password": "Ali@123456",
  "areaId": 1
}
```

`areaId` may be omitted or set to `null` when the worker has not yet been assigned. Password is hashed with bcrypt before storage.

### 2. List field workers

```http
GET /users?page=1&limit=20
```

Query parameters:

| Parameter | Type | Description |
|---|---|---|
| `page` | integer | Page number; default `1`. |
| `limit` | integer | Page size; default `20`, maximum `100`. |
| `search` | string | Search worker name or email. |
| `areaId` | integer | Filter by assigned area. |
| `isActive` | `true` / `false` | Filter by account status. |

### 3. Get field worker details

```http
GET /users/:id
```

### 4. Update field worker details

```http
PATCH /users/:id
```

Request (one or both fields):

```json
{
  "name": "Ali Khan Updated",
  "email": "ali.updated@example.com"
}
```

### 5. Activate or deactivate field worker

```http
PATCH /users/:id/status
```

Request:

```json
{
  "isActive": false
}
```

When a worker is deactivated, active refresh tokens are revoked. Authentication middleware also checks the user's current active status on every protected request.

### 6. Assign, reassign, or remove area

```http
PATCH /users/:id/area
```

Assign or reassign:

```json
{
  "areaId": 2
}
```

Remove assignment:

```json
{
  "areaId": null
}
```

## Households

All household endpoints require authentication and allow `SUPER_ADMIN` or `FIELD_WORKER`. Service-level checks restrict a field worker to their assigned area.

### 1. Create household

```http
POST /households
```

Super Admin request:

```json
{
  "householdCode": "HH-001",
  "areaId": 1,
  "address": "Street 5, North District",
  "latitude": 34.0151,
  "longitude": 71.5249
}
```

Field Worker request (the worker's assigned area is used by the backend):

```json
{
  "householdCode": "HH-002",
  "address": "Street 10, North District",
  "latitude": 34.0151,
  "longitude": 71.5249
}
```

Optional `clientId` may be supplied as a UUID by the mobile application. If omitted, the backend generates one. Field workers cannot choose another area.

### 2. List households

```http
GET /households?page=1&limit=20
```

Query parameters:

| Parameter | Type | Description |
|---|---|---|
| `page` | integer | Default `1`. |
| `limit` | integer | Default `20`, maximum `100`. |
| `search` | string | Searches household code and address. |
| `areaId` | integer | Area filter for Super Admin. For a field worker, a different area is forbidden. |

### 3. Get household details

```http
GET /households/:id
```

Returns household details, its area, and its active members.

### 4. Update household

```http
PATCH /households/:id
```

The current `version` is required.

Example:

```json
{
  "version": 1,
  "address": "Updated Street 5, North District",
  "latitude": 34.0155
}
```

The version increments after a successful update. A stale version returns `409 Conflict`. A field worker cannot change `householdCode` or `areaId`; a Super Admin can update household properties including area assignment.

### 5. Delete household

```http
DELETE /households/:id
```

Request:

```json
{
  "version": 2
}
```

Uses Sequelize paranoid/soft deletion. The record is not physically removed.

## Household members

All endpoints require authentication and allow `SUPER_ADMIN` or `FIELD_WORKER`. Access is checked through the member's parent household and its area.

### 1. Create member

```http
POST /household-members
```

Request:

```json
{
  "householdId": 1,
  "name": "Ali Khan",
  "age": 28,
  "gender": "MALE",
  "relationship": "HEAD"
}
```

Optional `clientId` can be sent as a UUID; otherwise the backend generates it.

Allowed `gender` values: `MALE`, `FEMALE`, `OTHER`.

Allowed `relationship` values: `HEAD`, `SPOUSE`, `CHILD`, `PARENT`, `SIBLING`, `OTHER`.

### 2. List household members

```http
GET /household-members?householdId=1&page=1&limit=20
```

`householdId` is required. `search` can be added to filter by member name.

### 3. Get member details

```http
GET /household-members/:id
```

### 4. Update member

```http
PATCH /household-members/:id
```

Request:

```json
{
  "version": 1,
  "name": "Ali Khan Updated",
  "age": 29
}
```

Member's household cannot be changed through this endpoint. The version increments after successful update.

### 5. Delete member

```http
DELETE /household-members/:id
```

Request:

```json
{
  "version": 2
}
```

Uses soft deletion and increments the version before setting the deletion timestamp.

## Health assessments

All endpoints require authentication and allow `SUPER_ADMIN` or `FIELD_WORKER`. A field worker can access assessments only when the related member belongs to a household in their assigned area.

### 1. Create assessment

```http
POST /health-assessments
```

Request:

```json
{
  "memberId": 1,
  "temperatureC": 39.0,
  "hasFever": true,
  "hasCough": true,
  "hasBreathingDifficulty": false,
  "systolic": 120,
  "diastolic": 80,
  "notes": "Patient reported fever.",
  "flaggedForReview": false
}
```

Optional `clientId` can be supplied as a UUID.

`isUrgent` is calculated by the backend; clients must not send it. The current application rule marks an assessment urgent when any of the following is true:

- Temperature is at least `38°C`.
- `hasFever` is `true`.
- `hasBreathingDifficulty` is `true`.
- `flaggedForReview` is `true`.

This is an application review-priority rule for the assignment, not a clinical diagnosis or medical triage protocol.

### 2. List assessments

```http
GET /health-assessments?page=1&limit=20
```

Available query parameters:

| Parameter | Type | Description |
|---|---|---|
| `page` | integer | Default `1`. |
| `limit` | integer | Default `20`, maximum `100`. |
| `memberId` | integer | Filter by household member. |
| `householdId` | integer | Filter by household. |
| `isUrgent` | `true` / `false` | Filter by urgency. |
| `flaggedForReview` | `true` / `false` | Filter by review flag. |

### 3. Get assessment details

```http
GET /health-assessments/:id
```

### 4. Update assessment

```http
PATCH /health-assessments/:id
```

Request:

```json
{
  "version": 1,
  "temperatureC": 37.0,
  "hasFever": false,
  "notes": "Temperature has decreased."
}
```

The backend recalculates `isUrgent` and increments the record version.

### 5. Delete assessment

```http
DELETE /health-assessments/:id
```

Request:

```json
{
  "version": 2
}
```

Uses soft deletion.

## Synchronization

Synchronization endpoints are restricted to `FIELD_WORKER` users. They operate on the field worker's currently assigned area.

### 1. Push offline operations

```http
POST /sync/push
```

A push request accepts between 1 and 100 operations. Operations are processed in the order supplied. Send parent creation operations before child operations: household, then household member, then health assessment.

Every operation has:

- `opId`: UUID identifying the operation. Reuse the same `opId` for retries of the same operation.
- `entity`: `HOUSEHOLD`, `HOUSEHOLD_MEMBER`, or `HEALTH_ASSESSMENT`.
- `action`: `CREATE`, `UPDATE`, or `DELETE`.
- `clientId`: UUID identifying the local record.
- `baseVersion`: required for `UPDATE` and `DELETE`.
- `data`: the operation payload for `CREATE` and `UPDATE`.

#### Create household operation

```json
{
  "operations": [
    {
      "opId": "11111111-1111-4111-8111-111111111111",
      "entity": "HOUSEHOLD",
      "action": "CREATE",
      "clientId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "data": {
        "householdCode": "HH-003",
        "address": "Street 15, North District",
        "latitude": 34.0151,
        "longitude": 71.5249
      }
    }
  ]
}
```

The server assigns the worker's area. The client does not send an `areaId` in the sync create payload.

#### Create household member operation

```json
{
  "operations": [
    {
      "opId": "22222222-2222-4222-8222-222222222222",
      "entity": "HOUSEHOLD_MEMBER",
      "action": "CREATE",
      "clientId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "data": {
        "householdClientId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "name": "Ali Khan",
        "age": 28,
        "gender": "MALE",
        "relationship": "HEAD"
      }
    }
  ]
}
```

`householdClientId` references the household created locally, without needing its server-generated integer ID.

#### Create health assessment operation

```json
{
  "operations": [
    {
      "opId": "33333333-3333-4333-8333-333333333333",
      "entity": "HEALTH_ASSESSMENT",
      "action": "CREATE",
      "clientId": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "data": {
        "memberClientId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "temperatureC": 39,
        "hasFever": true,
        "hasCough": true,
        "hasBreathingDifficulty": false,
        "systolic": 120,
        "diastolic": 80,
        "notes": "Patient reported fever.",
        "flaggedForReview": false
      }
    }
  ]
}
```

The backend calculates `isUrgent` and does not accept it from the client.

#### Update operation example

```json
{
  "operations": [
    {
      "opId": "44444444-4444-4444-8444-444444444444",
      "entity": "HOUSEHOLD",
      "action": "UPDATE",
      "clientId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "baseVersion": 1,
      "data": {
        "address": "Updated Street 15, North District"
      }
    }
  ]
}
```

Updateable fields depend on the entity schema. The version must match the server's current version.

#### Delete operation example

```json
{
  "operations": [
    {
      "opId": "55555555-5555-4555-8555-555555555555",
      "entity": "HOUSEHOLD_MEMBER",
      "action": "DELETE",
      "clientId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "baseVersion": 1
    }
  ]
}
```

Delete operations use soft deletion and increment the version.

#### Push response

The service returns an individual result per operation and a summary. Possible operation statuses are:

- `applied`: the operation was committed.
- `replayed`: the same operation ID and same request were already processed; the stored result is returned.
- `conflict`: the record version is stale or the operation ID was reused with a different request.
- `rejected`: validation, authorization, or reference/business-rule checks rejected the operation.

Example response shape:

```json
{
  "data": {
    "results": [
      {
        "opId": "11111111-1111-4111-8111-111111111111",
        "entity": "HOUSEHOLD",
        "action": "CREATE",
        "clientId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "status": "applied",
        "serverId": 3,
        "version": 1,
        "record": {}
      }
    ],
    "summary": {
      "received": 1,
      "applied": 1,
      "replayed": 0,
      "conflicts": 0,
      "rejected": 0
    }
  }
}
```

The values above are illustrative. The `record` contains the server representation returned by the operation.

**Idempotency rule:** the mobile client must preserve an operation's `opId` and exact payload when retrying it. A successful entity write and its `ProcessedOp` result are stored in the same database transaction. Reusing an `opId` with a different payload is rejected.

### 2. Pull server changes

```http
GET /sync/pull?limit=100
```

Optional query parameters:

| Parameter | Type | Description |
|---|---|---|
| `limit` | integer | Number of changes requested; default `100`, maximum `500`. |
| `cursor` | string | Opaque cursor returned by the previous pull response. Omit on the first pull. |

Example response shape:

```json
{
  "data": {
    "changes": [
      {
        "entity": "HOUSEHOLD",
        "operation": "UPSERT",
        "serverId": 3,
        "clientId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "version": 1,
        "updatedAt": "2026-11-06T12:00:00.000Z",
        "deletedAt": null,
        "data": {
          "householdCode": "HH-003",
          "areaId": 1,
          "address": "Street 15, North District",
          "latitude": "34.015100",
          "longitude": "71.524900"
        }
      }
    ],
    "nextCursor": "OPAQUE_CURSOR",
    "hasMore": false,
    "limit": 100
  }
}
```

`operation` is `UPSERT` for an active record and `DELETE` for a soft-deleted record. The pull service includes tombstones using Sequelize `paranoid: false` queries.

The mobile client should:

1. Apply all returned changes to its local SQLite database in a local transaction.
2. Commit the SQLite transaction successfully.
3. Only then persist `nextCursor` as its next pull cursor.
4. Continue requesting pages while `hasMore` is `true`.

Do not advance the local cursor before changes have been applied successfully. Otherwise, a failed local write could cause the client to skip server changes on its next pull.

### Mobile outbox recommendations

The backend expects the mobile app to keep an outbox of pending operations. A useful local outbox record includes `opId`, `entity`, `action`, `clientId`, `baseVersion`, `payload`, `status`, `attempts`, and timestamps. Keep pending operations until the backend reports `applied` or `replayed`. Preserve `conflict` and `rejected` operations for review/reconciliation rather than silently deleting them.

## Notifications

Notification routes require `SUPER_ADMIN`.

### 1. List notifications

```http
GET /notifications?page=1&limit=20
```

Optional query parameters:

- `page`: default `1`.
- `limit`: default `20`, maximum `100`.
- `unreadOnly=true`: return unread notifications only.

The response includes notification details and, when available, its related assessment, household member, household, and area.

### 2. Get unread count

```http
GET /notifications/unread-count
```

Response:

```json
{
  "data": {
    "unreadCount": 5
  }
}
```

### 3. Mark one notification as read

```http
PATCH /notifications/:id/read
```

Returns the notification with `isRead: true`. Repeating the request does not reset the original `readAt` timestamp.

### 4. Mark all notifications as read

```http
PATCH /notifications/read-all
```

Response:

```json
{
  "data": {
    "updatedCount": 4,
    "readAt": "2026-11-06T12:00:00.000Z"
  }
}
```

The notification creation service (`createUrgentNotification`) is intended to be called by the BullMQ worker. The worker integration is still pending; until it is connected and running, an urgent assessment job may be enqueued without a notification being created.

---

## Error responses

Most API errors use this structure:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Household not found"
  }
}
```

Common HTTP statuses:

| Status | Meaning |
|---|---|
| `400` | Validation error or malformed JSON. |
| `401` | Missing, invalid, or expired authentication credentials. |
| `403` | Authenticated user lacks the required role or permission. |
| `404` | Requested resource does not exist or is not accessible to the current field worker. |
| `409` | Unique-value conflict, stale version, or operation ID reuse. |
| `429` | Login rate limit exceeded. |
| `500` | Unexpected server error. |

Zod validation errors return `VALIDATION_ERROR` and include field paths and messages. Synchronization push requests return per-operation errors inside the `results` array rather than failing the entire batch for an individual operation.

## Database and data model

The current Sequelize models and main relationships are:

| Model | Purpose |
|---|---|
| `User` | Super Admin and Field Worker accounts. A worker can have one assigned area. |
| `RefreshToken` | Hashed, revocable refresh-token records. |
| `Area` | Area code, name, and description. |
| `Household` | Household identity, area, address, optional coordinates, version, and soft deletion. |
| `HouseholdMember` | Household member details, version, and soft deletion. |
| `HealthAssessment` | Health measurements, flags, urgency, version, and soft deletion. |
| `ProcessedOp` | Sync idempotency records keyed by operation UUID. |
| `Notification` | One notification per assessment, with read status. |

Important database behaviors:

- Sequelize uses `underscored: true` and timestamps, mapping camelCase model attributes to snake_case PostgreSQL columns.
- `Household`, `HouseholdMember`, and `HealthAssessment` use paranoid/soft deletion.
- Household/member/assessment versions support optimistic concurrency checks.
- UUID `clientId` values allow mobile-created records to be referenced before server integer IDs are known.
- `ProcessedOp` stores the result of a processed synchronization operation.

## Seeded administrator

The Super Admin seeder reads these environment variables:

```env
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=replace_with_a_strong_local_password
```

The seeder hashes the configured password with bcrypt. Use the values configured in your `.env` when logging in. Do not use a default or shared password in production.

Sample areas are also seeded by the current area seeder:

- `NORTH` — North District
- `SOUTH` — South District

## Background processing

BullMQ and Redis configuration exist, and the health-assessment service enqueues urgent assessment jobs on the `urgent-assessments` queue. The queue is configured with retries and exponential backoff.

The separate worker process and its processor that calls `createUrgentNotification()` are still to be completed. The current `src/worker.js` shared during development was a placeholder. Do not consider notification processing operational until the worker is implemented, started, and verified.

When completed, run the API and worker as separate processes. The worker should handle retries and duplicate jobs safely. The unique `notifications.assessment_id` constraint and `findOrCreate` logic provide database-level duplicate protection for notification creation.

## Caching

Redis is currently configured and checked by the `/health` endpoint. Dashboard statistics caching and cache invalidation are planned but are not yet documented as active API behavior. They will be added with the Dashboard and Redis caching modules.

## Testing

Jest and Supertest are installed in the project. Automated coverage for authentication, role authorization, CRUD operations, synchronization idempotency, conflicts, and deletion tombstones is still being added.

Run the test script after test configuration and test database setup are complete:

```bash
npm test
```

Use a separate test database and `.env.test`. Never run destructive migration-reset commands against a development or production database containing data you need.

## Known limitations and next steps

The following work remains before the backend assignment can be considered complete:

1. **Dashboard APIs:** household, worker, member, assessment, urgent-case, notification, and per-area statistics; recent records.
2. **Redis caching:** cache dashboard statistics and invalidate or expire cache entries after relevant writes.
3. **BullMQ worker:** implement the separate worker process that creates admin notifications for urgent assessments; verify retries and duplicate processing.
4. **Transactional outbox:** queue submission currently occurs after the assessment transaction. A process/Redis failure between database commit and queue submission can leave an urgent assessment without a notification job. A transactional outbox would make delivery more reliable.
5. **Deletion behavior:** define and test consistent logical deletion behavior for household descendants. A soft-deleted household does not automatically soft-delete its members and assessments with the current Sequelize associations.
6. **Synchronization integration tests:** test repeated operation IDs, same ID with changed payload, concurrent duplicate requests, out-of-order dependencies, stale versions, area reassignment, pagination, and tombstone delivery.
7. **Mobile integration:** implement the Expo SQLite outbox, retry handling, local/server ID mapping, conflict UI, and pull-cursor persistence.
8. **Automated tests and final README verification:** add Jest/Supertest coverage and verify every documented endpoint against the running API.

The assignment prioritizes backend authorization, offline persistence, synchronization, conflict handling, Redis caching, BullMQ background processing, tests, and documentation. The remaining items above should be completed and verified before submission.
