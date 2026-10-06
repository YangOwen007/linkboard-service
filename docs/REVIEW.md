# Review and release evidence

Review performed October 6, 2026. This records observed behavior, not a guarantee of security or reliability. No hosted deployment was performed.

## Findings before changes

| Severity / category | Evidence | Impact / resolution |
| --- | --- | --- |
| High / deployment | Dockerfile copied deleted `vitest.config.ts`, start pointed at `dist/server.js` while compilation emitted `dist/src/server.js`; runtime omitted Prisma CLI/client generation | Clean Docker startup could not work; repaired and exercised in a disposable environment |
| High / dependencies | `pnpm audit` reported 33 advisories: 9 moderate, 22 high, 2 critical | Updated Fastify and test tooling/transitives; patched Prisma config dependency with a tested override; subsequent audit reported zero |
| Medium / integrity and privacy | `/links/:slug/click` trusted arbitrary `x-forwarded-for`, stored full referrers and unbounded user-agent strings | Now uses connection IP, referrer origin only, and 256-character user agent; old stored rows require separate review |
| Medium / validation | Admin link/avatar URLs accepted arbitrary schemes; unexpected errors could expose internal messages | HTTP(S)-only validation, generic unexpected errors and Prisma error mappings, regression tests |
| Medium / abuse | Public click writes and admin access attempts had no rate limit | Added per-process connection-IP limits and 16 KiB body limit; multi-replica and proxy limitations are documented |
| Medium / CI | Three recent public runs failed; latest failure was Setup pnpm | Removed competing version selection; pinned action revisions and expanded clean-checkout verification |
| Medium / deployment documentation | Free database presented without expiry, smoke instructions assumed an unseeded hosted profile existed | Explicit account/secret/database requirements, 30-day expiry and backup constraints, intentional data setup commands |
| Low / repository presentation | README repeated portfolio/recruiter claims and interview language; description/topics empty | Factual README with architecture, setup, API, privacy and limitations; accurate GitHub metadata |

## Verification performed

- Baseline: `tsc --noEmit` and six Vitest tests passed against the existing local dependencies.
- After changes: `pnpm typecheck`, `pnpm test` (14 tests), `pnpm build`, `pnpm security:scan`, and `pnpm audit --audit-level=moderate` passed.
- Frozen-lockfile Docker builds generated Prisma and compiled TypeScript without local node_modules, `.env`, or build output.
- In a disposable PostgreSQL 16 container: `prisma migrate deploy` applied the committed migration; `scripts/smoke.mjs` passed database readiness, authorization, create/read, duplicate conflict, click analytics, deactivation, missing update, compiled-server startup, and Linux SIGTERM shutdown.
- Production Docker CMD was exercised separately: readiness 200, unauthenticated admin 401, database outage readiness 503, non-root user `node`, shutdown exit code 0.
- Gitleaks v8.30.0 scanned reachable Git history with redacted output. One historical documentation placeholder (`your-admin-key`) was verified and excluded by its exact fingerprint; rerun found no leaks. The lightweight scanner also checks working files and compiled output. Neither scanner proves secrets absent.
- Render Blueprint validated against `https://render.com/schema/render.yaml.json` using `pnpm dlx ajv-cli validate --strict=false --spec=draft2020 -s <downloaded-schema> -d render.yaml`. URI-format warnings were emitted by the validator; no invalid fields were reported. Render account/provisioning validation remains outstanding.
- GitHub API confirmed the public repository, its content, empty homepage/license/releases, recent failed runs, and the updated description/topics. Browser rendering could not be inspected: the local browser kernel failed during sandbox ACL setup. There is no frontend, so mobile/accessibility UI testing is not applicable.
- The published application CI for commit `fae5c36` passed every step: [verified run](https://github.com/YangOwen007/linkboard-service/actions/runs/37487938964). Subsequent commits must be checked separately; a successful Dependabot maintenance run is not application CI evidence.

## Warnings and practical limits

The globally installed newer pnpm prints a warning before dispatching to the repository's pnpm 9.15.1; Docker and CI use 9.15.1 directly. The lockfile includes the `deepmerge-ts` override, and Prisma generation/migration behavior was tested. Prisma 6 warns that `package.json#prisma` configuration is deprecated for Prisma 7; no untested major ORM migration was attempted. The image retains development tools, and OS packages installed from Debian repositories can change between image rebuilds even though the base image digest and application lockfile are pinned.

No actual credential was confirmed exposed, so no external credential rotation was performed. The published Git history includes the author's email metadata; history was not rewritten. Choose GitHub's private commit-email setting for future commits if desired.

## Remaining priorities

1. Provision hosting, production secrets, and a lasting database with tested backups; run the documented live verification and record the verified URL.
2. Choose retention/deletion policy and review older click rows; decide whether visitor-specific analytics warrants a trusted-proxy configuration.
3. Add pagination, per-profile access control only if needed, and separate migrations from a smaller runtime image before scaling.
4. Choose a license explicitly if open-source reuse is intended. No license was invented.

## File and repository summary

Runtime/security: `src/app.ts`, `src/server.ts`, `src/types.ts`, `src/config/env.ts`, `src/plugins/auth.ts`, `src/plugins/error-handler.ts`, `src/routes/admin.ts`, `src/routes/health.ts`, `src/routes/profiles.ts`.

Build/deployment/configuration: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `tsconfig.build.json`, `Dockerfile`, `docker-compose.yml`, `render.yaml`, `.env.example`, `.gitignore`, `.dockerignore`.

Tests/automation: `src/app.test.ts`, `vitest.config.mts` (replaces deleted config), `scripts/smoke.mjs`, `scripts/secret-scan.mjs`, `.gitleaksignore`, `.github/workflows/ci.yml`, `.github/dependabot.yml`.

Presentation: `README.md`, `docs/DEPLOYMENT.md`, this report, and factual demo seed links in `prisma/seed.ts`. GitHub name remains `linkboard-service`; description/topics were updated, homepage remains empty because no public deployment is verified.

Intentionally untouched: local `.env`, existing Docker project data, database schema/migration history, and published Git history. No private values were copied into documentation or new commits.
