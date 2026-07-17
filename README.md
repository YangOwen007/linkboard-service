# Linkboard Service

`Linkboard Service` is a backend-focused portfolio project: a production-minded link-in-bio API with click analytics, admin endpoints, PostgreSQL persistence, validation, testing, Docker, and CI.

## Portfolio Snapshot

- Backend-focused API service, not a frontend CRUD app
- Public profile delivery plus protected admin management
- Event-style analytics persistence for click tracking
- Production-minded setup with Docker, CI, env validation, and deployment notes

## Why This Project

This service is designed to show backend engineering depth instead of frontend polish alone:

- REST API design with public and protected routes
- Database modeling with Prisma and PostgreSQL
- Input validation with Zod
- Structured logging and centralized error handling
- Health checks and environment-based configuration
- Dockerized local development
- CI with GitHub Actions

## Tech Stack

- `Fastify` for the HTTP server
- `TypeScript` for safety and maintainability
- `PostgreSQL` for persistent storage
- `Prisma` for schema management and database access
- `Zod` for request and environment validation
- `Vitest` for API-focused tests
- `Docker` and `docker-compose` for local infrastructure

## What It Demonstrates

- API design with public and internal/admin boundaries
- Data modeling for profiles, links, and click events
- Validation at both the request layer and environment layer
- Basic access control with an admin API key
- Structured error handling and operational health checks
- Containerization and deployment workflow readiness

## MVP Features

- `GET /health` for health checks
- `GET /profiles/:handle` for the public linkboard view
- `POST /links/:slug/click` to record analytics events
- `GET /admin/profiles` for protected profile inspection
- `POST /admin/profiles` for protected profile creation
- `POST /admin/links` for protected link creation
- `PATCH /admin/links/:id` for protected link updates
- `GET /admin/links/:slug/analytics` for protected click summaries

## API Shape

Public endpoints:

- `GET /health`
- `GET /profiles/:handle`
- `POST /links/:slug/click`

Admin endpoints:

- `GET /admin/profiles`
- `POST /admin/profiles`
- `POST /admin/links`
- `PATCH /admin/links/:id`
- `GET /admin/links/:slug/analytics`

Example requests:

```bash
curl http://localhost:3000/health
```

```bash
curl http://localhost:3000/profiles/owenyang
```

```bash
curl -X POST http://localhost:3000/links/github/click
```

```bash
curl -H "x-api-key: your-admin-key" http://localhost:3000/admin/profiles
```

## Local Setup

1. Use Node `22+` and `pnpm`.
2. Copy `.env.example` to `.env` and fill in secure values.
3. Start PostgreSQL with Docker:

```bash
docker compose up -d
```

4. Install dependencies:

```bash
pnpm install
```

5. Generate the Prisma client and apply migrations:

```bash
pnpm prisma generate
pnpm prisma migrate dev --name init
```

6. Seed demo data:

```bash
pnpm prisma:seed
```

7. Start the dev server:

```bash
pnpm dev
```

## Verification

Run the most important checks with:

```bash
pnpm lint
pnpm test
pnpm build
```

If you want a full local smoke test after the server is running:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/profiles/owenyang
```

## Environment Variables

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `ADMIN_API_KEY` | Shared secret for admin routes |
| `IP_HASH_SALT` | Salt used to hash IP addresses before storing analytics data |
| `HOST` / `PORT` | Server bind settings |
| `LOG_LEVEL` | Structured logging verbosity |

## Data Model

- `Profile`: the public identity for a linkboard page
- `Link`: an ordered outbound destination attached to a profile
- `ClickEvent`: a timestamped analytics event recorded for a link click

This model is intentionally simple for an MVP, but it leaves room for future additions like per-profile API keys, rate limiting, aggregated analytics tables, or scheduled reporting jobs.

Note: the included Docker setup maps PostgreSQL to host port `5433` so it does not conflict with an existing local Postgres instance or another project already using `5432`.

## Project Structure

```text
src/
  config/      Environment parsing
  lib/         Shared infrastructure helpers
  plugins/     Fastify plugins for auth and errors
  routes/      Public and admin HTTP routes
prisma/
  migrations/  Database migration history
  schema.prisma
  seed.ts
```

## Deployment Notes

This project is a good fit for `Render` or `Railway`:

- provision a managed PostgreSQL database
- set the environment variables from `.env.example`
- build command: `pnpm install && pnpm prisma generate && pnpm build`
- start command: `pnpm prisma migrate deploy && pnpm start`
- `render.yaml` is included as a starter deployment config for Render

## Roadmap

- Rate limiting for analytics endpoints
- Request logging enrichment or tracing IDs
- OpenAPI docs
- Aggregated analytics endpoint by date range
- API key rotation or per-profile admin auth
- Background job support for report generation

## Interview Story

You can explain this project as:

> I built a deployable backend service that manages public profile links and tracks click analytics. I designed the API, modeled the data in PostgreSQL, added access control, validation, logging, tests, Docker setup, and CI so it felt like a real service instead of a classroom CRUD app.

## Why Recruiters Care

- It shows backend system design choices, not just UI polish
- It gives you concrete talking points for APIs, persistence, deployment, and operational readiness
- It is small enough to understand fully, but serious enough to discuss like a real service
