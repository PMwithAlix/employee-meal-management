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

Role/building rules must still be enforced in the future service layer. Argon2id hashing is not implemented here; `users.passwordHash` only stores the hash.

## Starting the backend in development

```bash
cd backend
npm run start:dev
```

API base prefix: `/api/v1`

## Tests

```bash
npm test
npm run test:e2e
```

Unit tests cover health-check success and database failure. E2E tests boot the Nest application with a mocked Prisma client so they do not require a live database.

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
    common/           # HTTP filter and request logging
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
