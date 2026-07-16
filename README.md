# Linkboard Service

`Linkboard Service` is a backend-focused portfolio project: a production-minded link-in-bio API with click analytics, admin endpoints, PostgreSQL persistence, validation, testing, Docker, and CI.

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

## MVP Features

- `GET /health` for health checks
- `GET /profiles/:handle` for the public linkboard view
- `POST /links/:slug/click` to record analytics events
- `GET /admin/profiles` for protected profile inspection
- `POST /admin/profiles` for protected profile creation
- `POST /admin/links` for protected link creation
- `PATCH /admin/links/:id` for protected link updates
- `GET /admin/links/:slug/analytics` for protected click summaries

## Local Setup

1. Copy `.env.example` to `.env` and fill in secure values.
2. Start PostgreSQL with Docker:

```bash
docker compose up -d
```

3. Install dependencies:

```bash
pnpm install
```

4. Generate the Prisma client and apply migrations:

```bash
pnpm prisma generate
pnpm prisma migrate dev --name init
```

5. Seed demo data:

```bash
pnpm prisma:seed
```

6. Start the dev server:

```bash
pnpm dev
```

## Environment Variables

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `ADMIN_API_KEY` | Shared secret for admin routes |
| `IP_HASH_SALT` | Salt used to hash IP addresses before storing analytics data |
| `HOST` / `PORT` | Server bind settings |
| `LOG_LEVEL` | Structured logging verbosity |

## Project Structure

```text
src/
  config/      Environment parsing
  lib/         Shared infrastructure helpers
  plugins/     Fastify plugins for auth and errors
  routes/      Public and admin HTTP routes
prisma/
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

## Interview Story

You can explain this project as:

> I built a deployable backend service that manages public profile links and tracks click analytics. I designed the API, modeled the data in PostgreSQL, added access control, validation, logging, tests, Docker setup, and CI so it felt like a real service instead of a classroom CRUD app.
