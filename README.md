# Linkboard Service

A Fastify HTTP API that publishes profile links and records click events in PostgreSQL. Public clients can read active profiles and submit click events; an operator uses an API key to manage profiles, links, and analytics.

## Current status

This is a small backend learning project by Owen Yang. It has no web UI, user accounts, or verified public deployment. The repository includes a Docker image definition and a Render Blueprint; hosting still requires a Render account, a PostgreSQL database, and production secrets. Tests and CI are described below without claiming production reliability.

## Architecture and decisions

Requests flow through Fastify, access control (for `/admin`), Zod validation, and Prisma queries to PostgreSQL. Route modules share injected dependencies so unit tests can use database stubs. PostgreSQL enforces unique handles/slugs and foreign keys; deleting a profile cascades to its links and click events.

- Fastify and TypeScript keep the HTTP service independent of a frontend framework.
- Prisma migrations are committed and applied with `migrate deploy`; reviewers do not need to invent an initial migration.
- One shared operator key is simple for a single-owner service. It gives access to all records and is not multi-tenant authorization.
- Clicks are explicit events, not redirects. A submitted event does not prove a human visited the destination.
- The server uses the connection IP and does not trust forwarded headers. Behind a proxy this may group visitors under the proxy IP; configure a reviewed trusted-proxy policy before relying on visitor counts or per-visitor limits.

## Requirements and local setup

Use Node.js 22 or 24, pnpm **9.15.1**, and Docker Desktop with Linux containers. PostgreSQL 16 is the tested database. The pinned package manager and lockfile are used in Docker and CI.

PowerShell, from the repository directory:

```powershell
npm install -g pnpm@9.15.1
Copy-Item .env.example .env
docker compose up -d --wait
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm prisma:deploy
pnpm prisma:seed
pnpm dev
```

Copy the environment example only on the first setup so you do not overwrite existing settings. On macOS/Linux replace `Copy-Item .env.example .env` with `cp .env.example .env`.

The database binds to **127.0.0.1:5433** and persists in a named Docker volume. Default HTTP port is 3000; set `PORT=3001` in `.env` if another app uses 3000. Node loads `.env` for the dev/start scripts; hosted environment variables take precedence. The seed is explicit demo data, not automatically inserted at deployment, and rerunning it leaves an existing `owenyang` profile unchanged.

In another PowerShell window (adjust the port to your configuration):

```powershell
Invoke-RestMethod http://localhost:3000/ready
Invoke-RestMethod http://localhost:3000/profiles/owenyang
Invoke-RestMethod -Method Post http://localhost:3000/links/github/click -ContentType application/json -Body '{}'
```

## Configuration

| Variable | Required | Default / behavior |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection URL; local example credentials are disposable |
| `ADMIN_API_KEY` | Yes | 16+ characters locally; 32+ random characters in production |
| `IP_HASH_SALT` | Yes | Separate salt, same length requirements; do not reuse the admin key |
| `NODE_ENV` | No | development; set production when hosted |
| `HOST` | No | 0.0.0.0 |
| `PORT` | No | 3000; accepts the platform-supplied port |
| `LOG_LEVEL` | No | info; structured JSON in production |

Generate each production secret independently with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Store values in the host's secret settings, never GitHub files or screenshots. Production rejects the supplied secret placeholders. Use your database provider's TLS requirements; do not disable certificate verification.

## API

Admin requests require an `x-api-key` header. JSON request bodies use `Content-Type: application/json`.

| Method | Path | Result |
| --- | --- | --- |
| GET | /health | HTTP liveness; does not probe PostgreSQL |
| GET | /ready | Database probe; 200 ready or 503 unavailable |
| GET | /profiles/:handle | Active profile and ordered active links, or 404 |
| POST | /links/:slug/click | Records an event, returns 202; inactive/missing links return 404 |
| GET | /admin/profiles | Up to 100 newest profiles with links |
| POST | /admin/profiles | Creates a profile, returns 201 |
| POST | /admin/links | Creates a link, returns 201 |
| PATCH | /admin/links/:id | Changes title, URL, position, or active state |
| GET | /admin/links/:slug/analytics | Total events and the 10 most recent events |

Profile body: `{ "handle": "demo", "displayName": "Demo", "bio": "Optional" }`.
Link body: `{ "profileId": "<id returned by create>", "slug": "docs", "title": "Docs", "url": "https://example.com", "position": 1 }`.
Optional `isActive` defaults to true; optional profile `avatarUrl` must be HTTP(S).
Slugs are globally unique across profiles. PATCH requires at least one supported field.

Responses use 400 for validation/invalid references, 401 for admin access, 404 for missing records, 409 for duplicates, 413 for oversized bodies, 429 for rate limits, and a generic 500 for unexpected failures. Public endpoints return JSON; `/` has no homepage.

## Verification and scripts

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm security:scan
pnpm audit --audit-level=moderate
```

`pnpm lint` is a legacy alias for TypeScript checking, not a style linter.
Unit tests inject requests into Fastify with Prisma stubs. The database smoke test also runs CRUD, duplicate handling, deactivation, analytics, and (on Linux) the compiled entry point with SIGTERM. Run it **only against a disposable test database**, after generation, migration, and build:

```powershell
$env:ALLOW_INTEGRATION_WRITES = "true"
pnpm test:integration
Remove-Item Env:ALLOW_INTEGRATION_WRITES
```

The smoke test creates uniquely named records and deletes those records afterward. It does not seed or clear the database. CI uses its own PostgreSQL service and runs typecheck, tests, build, integration smoke, credential-pattern scan, audit, and Docker build. Dependabot proposes dependency updates. The lightweight credential scan checks current files and reachable history; it cannot prove that secrets are absent.

## Production build and deployment

```powershell
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm build
pnpm prisma:deploy
pnpm start
```

Set `NODE_ENV=production` and production secrets before starting. The compiled entry point is `dist/src/server.js`. Docker installs frozen dependencies, generates the Prisma client, runs as a non-root user, applies migrations before starting, and forwards shutdown signals to Node.

See [Deployment guide](docs/DEPLOYMENT.md) for Render setup, verification, recovery, and backup steps. There is no live demo URL yet. Render's free web service can sleep after inactivity; its free PostgreSQL expires after 30 days and has no managed backups. The Blueprint is a temporary evaluation option, not permanent free hosting: [Render free-instance limits](https://render.com/docs/free).

## Security, privacy, and limitations

- Deploy behind HTTPS. Keep the operator key out of browser/frontend code; rotate it through the hosting environment if exposed.
- Request bodies are capped at 16 KiB. A per-process limit allows 120 requests per connection IP per minute; health probes are exempt. Limits reset at restart and do not coordinate multiple replicas.
- Analytics stores a timestamp, referrer **origin only**, truncated user agent, and salted IP hash. Hashes remain pseudonymous data, not guaranteed anonymity. Behind a proxy, the hash may represent the proxy.
- Existing events written before referrer minimization may contain full URLs. Review/delete old demo events before public use. There is no automatic retention schedule; operators must define retention and delete old events.
- Link destinations are validated HTTP(S) URLs, not fetched or reputation-checked by this service. CORS is not configured; a future cross-origin frontend needs an explicit origin policy.
- No per-user accounts, per-profile permissions, pagination cursor, public analytics accuracy guarantees, or automated backups. Admin listing caps profiles but nested link lists remain unbounded.
- The image retains build/test dependencies for the migration CLI. Prisma's `deepmerge-ts` dependency is overridden to a patched version; generation and migration checks must pass whenever this override changes.
- No license has been selected. Public visibility does not itself grant an open-source license.

## Next improvements

Define retention/deletion behavior, add cursor pagination, document the API with OpenAPI, separate migration tooling from a slimmer runtime image, and add a shared rate-limit store if multiple replicas become necessary.
