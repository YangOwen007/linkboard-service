# Deployment guide

## Prerequisites

This repository targets one Docker web service and PostgreSQL 16 on Render. No hosted deployment has been verified. You need a Render account connected to this GitHub repository, a PostgreSQL instance, and two separate randomly generated secrets. The included free database is for evaluation: it expires after 30 days and has no backups. Review [Render's limits](https://render.com/docs/free) before provisioning. A lasting service needs a suitable database plan or a separately managed database; do not assume free means always available.

## Release checks

1. Run `pnpm install --frozen-lockfile`, `pnpm prisma:generate`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm security:scan`, and `pnpm audit --audit-level=moderate`.
2. Run `pnpm prisma:deploy` and `pnpm test:integration` against a disposable database with `ALLOW_INTEGRATION_WRITES=true`.
3. Build with `docker build -t linkboard-service .`. Record the Git commit you intend to deploy; inspect its CI result before releasing.
4. Back up a database that already holds valuable data before applying migrations. Never use `migrate reset`, `db push`, or demo seed as a release step.

## Render

1. Push the verified commit, sign in to Render, and create a Blueprint from `YangOwen007/linkboard-service` using `render.yaml`.
2. Review the proposed free web/database resources and their expiry/usage limits. No paid plan is selected by this repository.
3. Supply `ADMIN_API_KEY` with at least 32 random characters. The Blueprint generates a separate `IP_HASH_SALT` and injects the database connection URL. Set `NODE_ENV=production`, `HOST=0.0.0.0`, and `LOG_LEVEL=info`; Render supplies `PORT`. Database public access is disabled; use the private connection from the service. A backup from your own machine requires temporarily allowing only your IP and removing that rule afterward.
4. Deploy the Docker service. Its startup runs `prisma migrate deploy` and only starts HTTP if that succeeds. The readiness path is `/ready`.
5. Observe startup logs and verify the endpoints below. Record the deployment URL only after verifying it. There is no automatic production seed: an empty database returning 404 for a profile is expected.

For an external PostgreSQL database, replace the Blueprint's `fromDatabase` reference with a secret `DATABASE_URL` and remove its `databases` block before provisioning. Confirm TLS, network access, connection limits, region, backups, and provider pricing first. Deploy one replica with this startup migration approach; a larger deployment should use a separate release job.

## Live verification (PowerShell)

Use the service URL and enter the key locally without putting it in command history:

```powershell
$base = 'https://YOUR-SERVICE.onrender.com'
Invoke-RestMethod "$base/health"
Invoke-RestMethod "$base/ready"
$key = Read-Host 'Admin key' -AsSecureString
$headers = @{ 'x-api-key' = [System.Net.NetworkCredential]::new('', $key).Password }
Invoke-RestMethod "$base/admin/profiles" -Headers $headers
```

An unauthenticated request to `/admin/profiles` must return 401. On an empty deployment, create a profile and a link intentionally:

```powershell
$profile = Invoke-RestMethod -Method Post "$base/admin/profiles" -Headers $headers -ContentType application/json -Body '{"handle":"demo","displayName":"Demo"}'
$body = @{ profileId=$profile.id; slug='demo-docs'; title='Source'; url='https://github.com/YangOwen007/linkboard-service'; position=1 } | ConvertTo-Json
Invoke-RestMethod -Method Post "$base/admin/links" -Headers $headers -ContentType application/json -Body $body
Invoke-RestMethod "$base/profiles/demo"
Invoke-RestMethod -Method Post "$base/links/demo-docs/click" -ContentType application/json -Body '{}'
Invoke-RestMethod "$base/admin/links/demo-docs/analytics" -Headers $headers
Remove-Variable headers,key
```

Use different handles/slugs if those already exist. These commands create persistent public demo records; do not put personal or private data in them. Confirm one click in analytics. The API does not serve a webpage at `/`.

## Recovery and operations

| Symptom | Check / recovery |
| --- | --- |
| Startup fails before listening | Check required environment fields and generated Prisma client; secret values are intentionally omitted from startup output |
| Migration fails | Inspect Render migration output privately, check connectivity and migration state with `prisma migrate status`; repair the cause before redeploying, never reset valuable data |
| `/health` works, `/ready` returns 503 | PostgreSQL availability, network access, connection limits, TLS, and free-instance expiration |
| Initial request is slow | Free services may sleep after 15 idle minutes; wake-up can take about a minute |
| Admin request returns 401 | Correct key in `x-api-key`, updated environment, and completed restart |
| Requests return 429 | Wait for `Retry-After`; proxy visitors may share the connection-IP limit |
| Port conflict locally | Change HTTP `PORT` or database mapping and `DATABASE_URL` together |

Structured JSON logs include request IDs and response status. Treat logs as potentially sensitive: Fastify request logs can contain request URLs and connection IPs. Do not send secrets in URL query parameters. Configure host access and log retention. Current referrer sanitization does not retroactively clean older events.

Before any schema change, use the database provider's backup/export process or `pg_dump --format=custom --file=linkboard.dump` with securely supplied connection settings. Keep backups outside Git and the container filesystem, restrict access, and test restoration to a separate database. A free Render database has no managed backups.

Rollback the application to the prior verified commit/image through Render. Code rollback does **not** undo migrations; use backward-compatible migrations, or restore a tested backup to a new database and explicitly switch the connection URL. Track the deployed commit, backup timestamp, and verification results. The Blueprint uses `autoDeployTrigger: checksPass` so automatic deployments wait for linked-branch CI checks. Disable auto-deploy in the dashboard if manual release control is desired.
