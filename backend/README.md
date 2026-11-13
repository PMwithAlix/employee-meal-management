# Khaan backend

Phase 0 foundation for خوان (Khaan), the employee meal ordering platform.

Stack: NestJS modular monolith, TypeScript, PostgreSQL, Prisma, REST, Swagger, Docker.

Business modules, authentication, and domain schema are intentionally out of scope.

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

There are no business models in this phase, so there is nothing to migrate yet.

```bash
npx prisma generate
npx prisma validate
npx prisma migrate dev   # use after domain models are added
```

Prisma Client connects with `DATABASE_URL`. Timestamps are stored in UTC. Date-only business values will use PostgreSQL `DATE`. The business timezone is `Asia/Tehran`; Jalali conversion stays at the application boundary.

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
