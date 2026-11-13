# Khaan backend

Phase 0 foundation for خوان (Khaan), the employee meal ordering platform.

Stack: NestJS modular monolith, TypeScript, PostgreSQL, Prisma, REST, Swagger, Docker.

Business modules, authentication, and application services are out of scope. The Prisma domain schema is in place.

## Prerequisites

- Node.js 20.19+ or 22.12+ (this repo was verified on Node 22.19)
- npm 10+
- Docker Engine with Compose v2

## Environment setup

```bash
cd backend
copy .env.example .env   # Windows
# cp .env.example .env  # macOS / Linux
```

Required variables:

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development`, `test`, or `production` |
| `PORT` | HTTP port (default in example: `3000`) |
| `DATABASE_URL` | Prisma PostgreSQL connection string |
| `FRONTEND_ORIGIN` | Allowed CORS origin (credentials enabled) |
| `SESSION_TTL_SECONDS` | Absolute session lifetime (default 28800) |
| `SESSION_COOKIE_NAME` | HttpOnly cookie name (default `khaan.sid`) |
| `SESSION_COOKIE_PATH` | Cookie path (default `/api/v1`) |
| `SESSION_SAMESITE` | `lax`, `strict`, or `none` |
| `SESSION_SECURE` | `true` in production |
| `ARGON2_MEMORY_KIB` / `ARGON2_TIME_COST` / `ARGON2_PARALLELISM` | Argon2id parameters |
| `LOGIN_RATE_LIMIT_MAX` / `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | In-process login throttle |

Docker Compose also reads:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `POSTGRES_PORT`

Do not commit `.env`. Example values are for local development only.

## Installing dependencies

```bash
cd backend
npm install
npx prisma generate
```

## Starting PostgreSQL

PostgreSQL is isolated from the Nest process:

```bash
cd backend
docker compose up -d postgres
docker compose ps
docker compose down
```

Data is stored in the named volume `khaan_postgres_data`.

## Prisma commands

```bash
npx prisma generate
npx prisma validate
npx prisma migrate deploy
npx prisma migrate dev   # local development only; do not use migrate reset
```

Initial domain migration: `prisma/migrations/20261113163606_init_domain_schema`.

Prisma Client connects with `DATABASE_URL`. Timestamps are UTC `TIMESTAMPTZ`. Date-only values use PostgreSQL `DATE`. Serving time uses `TIME`. The business timezone is `Asia/Tehran`; Jalali conversion stays at the application boundary.

### Domain tables

`users`, `sessions`, `buildings`, `groups`, `group_memberships`, `menus`, `menu_versions`, `menu_items`, `orders`, `order_cycles`, `order_status_history`, `order_group_snapshots`, `guest_orders`, `guest_order_history`, `system_settings`, `order_deadlines`, `meal_settings`, `ratings`, `notifications`, `audit_logs`

### Enums

- `Role`: EMPLOYEE, HR, SUPPORT, MANAGEMENT, ADMIN
- `MealType`: LUNCH, DINNER
- `MenuVersionStatus`: DRAFT, PUBLISHED
- `OrderCycleStatus`: ACTIVE, CANCELLED
- `GuestOrderStatus`: ACTIVE, CANCELLED
- `GuestOrderAction`: CREATED, UPDATED, CANCELLED

`notifications.type` and `audit_logs.action` are strings because allowed values were not specified for this phase.

### SQL-only constraints

Defined in the init migration, not in Prisma schema:

- Username must be trimmed lowercase; username cannot change after insert
- Non-ADMIN users must have `buildingId`
- One active group membership per user/group; overlapping membership ranges are excluded
- At most three menu items per version/date/meal; display order 1–3
- Published menu versions cannot gain, lose, or change items
- `menus.publishedVersionId` must point at a PUBLISHED version of the same menu
- One ACTIVE order cycle per order; cycle snapshot fields cannot be rewritten or deleted
- Guest order quantity ≥ 1; rating score 1–5
- `audit_logs` cannot be updated or deleted

Role/building rules must still be enforced in the future service layer. Passwords are stored only as Argon2id hashes.

## Starting the backend in development

```bash
cd backend
npm run start:dev
```

API base prefix: `/api/v1`

## Authentication

Session cookies, not JWT. There is no public registration.

| Method | Path | Access |
|---|---|---|
| POST | `/api/v1/auth/login` | Public |
| POST | `/api/v1/auth/logout` | Session |
| GET | `/api/v1/auth/me` | Session |
| POST | `/api/v1/auth/change-password` | Session |
| POST | `/api/v1/auth/logout-all` | Session |
| GET | `/api/v1/health` | Public |

Login body: `{ "username": "...", "password": "..." }`. Username is trimmed and lowercased; the password is not normalized. Invalid username and wrong password return the same 401. Inactive accounts return 403 after a correct password.

The session token is a cryptographically random value sent only in the `khaan.sid` HttpOnly cookie (`Path=/api/v1`). PostgreSQL stores SHA-256 of the token, never the raw value. `Secure` is enabled in production. `SameSite` defaults to `lax` (same-site localhost frontend/API). Mutating requests in production must send `Origin` equal to `FRONTEND_ORIGIN`.

Logout clears the current session row and cookie. Logout-all deletes every session for that user. Change-password verifies the current password, checks the product policy (minimum 8 characters, at least one English letter and one digit), stores a new Argon2id hash, and revokes every session so the client must log in again. Users cannot change their own username, role, or building through public APIs.

`AuthGuard` loads the user from the session row (role comes from the database, never from a request header). `RolesGuard` plus `@Roles(...)` restrict endpoints. `@CurrentUser()` injects the authenticated principal. `@Public()` marks unauthenticated routes on a guarded controller.

Login is rate-limited in process (default 5 attempts / 15 minutes per IP + username).

## First ADMIN bootstrap

There is no public registration and no HTTP endpoint that creates the first admin. After migrations, with an empty `users` table:

```bash
cd backend
npm run build
# PowerShell
$env:BOOTSTRAP_ADMIN_USERNAME="admin"
$env:BOOTSTRAP_ADMIN_PASSWORD="your-strong-password-1"
npm run bootstrap:admin
```

Both variables are required. The password is hashed with the same Argon2id `PasswordService` as login. The raw password is not printed. Re-running bootstrap after any user exists exits with an error and does not overwrite accounts. The initial ADMIN may have no building.

## Users, buildings, and groups

All routes below require an authenticated HR or ADMIN session cookie. EMPLOYEE, SUPPORT, and MANAGEMENT receive `403`.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/users` | Create account. Username is trimmed and lowercased; password is not normalized. |
| GET | `/api/v1/users` | Filter `username`, `role`, `buildingId`, `isActive`; paginate `page`, `pageSize`; sort `sortBy`, `sortOrder`. |
| GET | `/api/v1/users/:id` | Public user fields only (no password hash, no sessions). |
| PATCH | `/api/v1/users/:id` | Role and/or `buildingId` only. Changing either revokes sessions. |
| POST | `/api/v1/users/:id/deactivate` | Soft-disable; revokes sessions. Username stays reserved. |
| POST | `/api/v1/users/:id/reactivate` | Does not rewrite history. |
| POST | `/api/v1/users/:id/reset-password` | Body `{ "newPassword": "..." }`. Revokes sessions and sends an in-app notification (no secret in the message). |
| POST | `/api/v1/buildings` | Name is not unique. |
| GET | `/api/v1/buildings` | |
| GET | `/api/v1/buildings/:id` | |
| PATCH | `/api/v1/buildings/:id` | Rename only. No delete route; buildings with users cannot be removed. |
| POST | `/api/v1/groups` | Unique Persian name (organization-wide). |
| GET | `/api/v1/groups` | Active groups only. |
| GET | `/api/v1/groups/:id` | |
| PATCH | `/api/v1/groups/:id` | Rename. |
| POST | `/api/v1/groups/:id/deactivate` | Sets `isActive=false` and closes open memberships. History is kept. |
| GET | `/api/v1/groups/:id/members` | Active memberships (`endedAt` is null). |
| POST | `/api/v1/groups/:id/members` | Body `{ "userId": "..." }`. Inactive users cannot be added. |
| DELETE | `/api/v1/groups/:id/members/:userId` | Sets `endedAt`; does not delete the row. |
| GET | `/api/v1/groups/:id/memberships/history` | All membership rows for reporting later. |

### Role access matrix

| Action | EMPLOYEE / SUPPORT / MANAGEMENT | HR | ADMIN |
|---|---|---|---|
| Auth (self login/logout/me/change-password) | Yes | Yes | Yes |
| Create/list/update users | No | EMPLOYEE, SUPPORT, MANAGEMENT only | All roles |
| Create ADMIN / manage ADMIN or HR accounts | No | No | Yes |
| Deactivate / reset password | No | Same as create (not ADMIN or HR) | Yes |
| Buildings and groups | No | Yes | Yes |

Non-ADMIN users must have a `buildingId`. ADMIN may omit it. Group membership does not change role or building. Historical membership rows are never overwritten; re-adding a user after `endedAt` creates a new row. Overlapping intervals are rejected by the database exclusion constraint.

Mutating operations write `audit_logs` in the same transaction when possible. Actor ID comes from the session, never from the request body. Passwords, hashes, and session tokens are stripped from before/after JSON.

## Tests

```bash
npm test
npm run test:e2e
```

Unit tests cover health, auth, user-access rules, and audit sanitization. Auth and organization e2e tests need PostgreSQL and write temporary `e2e.auth.*` / `e2e.org.*` users, then delete them.

## Production build

```bash
npm run build
npm run start:prod
```

## Swagger

Development / test only: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

Swagger is not mounted when `NODE_ENV=production`.

## Health

`GET /api/v1/health`

Runs `SELECT 1` against PostgreSQL and returns:

- `status`: `ok` or `error`
- `database`: `up` or `down`
- `timestamp`: ISO-8601 UTC
- `environment`: current `NODE_ENV`

HTTP `503` is returned when the database is unavailable.

## Project structure

```
backend/
  src/
    common/           # filters, interceptors, guards, decorators
    auth/             # login, sessions, passwords, RBAC wiring
    users/            # HR/Admin user administration
    buildings/        # building CRUD (no delete)
    groups/           # groups and membership history
    audit/            # shared audit writer
    cli/              # one-time bootstrap:admin
    config/           # environment validation
    database/         # PrismaService + DatabaseModule
    health/           # live health endpoint
    app.module.ts
    app.setup.ts
    main.ts
  prisma/schema.prisma
  test/
  Dockerfile
  docker-compose.yml
```

## Time conventions

- Store timestamps in UTC.
- Use PostgreSQL `DATE` for date-only values.
- Do not persist Jalali strings.
- Keep `Asia/Tehran` handling explicit in later application code.
