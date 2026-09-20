# pergolando-backend

App Venditore's backend — NestJS + Prisma + SQLite. Part of [Pergolando](https://github.com/daviderdsign),
a white-label configurator for pergola/awning manufacturers.

## One deployment per tenant, not row-level multi-tenancy

This is a deliberate, discussed deviation from a generic "multi-tenant SaaS" shape. Studio produces one
bundle per manufacturer client; **App Venditore runs as one container per client**, each pointed at that
client's bundle and its own SQLite file via env vars (`BUNDLE_PATH`, `DATABASE_URL`). There is no `tenant_id`
column anywhere in the schema and no cross-tenant-isolation test suite, because there is no shared database
or process to isolate within — the isolation is the separate container and separate file. Adding a client is
an ops action (new bundle export + a new `docker-compose` service block), not a runtime registration flow.

## Stack

- NestJS (SOLID: modules own one responsibility; `SessionStore` is an interface with a Prisma-backed
  implementation, so swapping the session backend later doesn't touch `AuthService`).
- Prisma + SQLite (a real file, matching the self-hosted NAS deployment — no serverless-compatible substitute).
- Argon2id password hashing, DB-backed sessions (httpOnly/Secure/SameSite cookie, 7-day sliding expiry,
  regenerated on every login), per-IP throttling (`@nestjs/throttler`) plus a separate per-account lockout
  (`Seller.failedLoginAttempts`/`lockedUntil`) — two different attack shapes, two different mechanisms.
- Pino structured logging (`nestjs-pino`), one line per request with a request id, cookies/auth headers
  redacted.
- `@pergolando/shared` (git dependency, tagged) for the bundle schema and pricing engine — see that repo's
  README for why it's a git dependency rather than an npm package.
- REST versioned from day one: everything under `/api/v1`.

## Scope of this slice

Auth (register/login/logout/me) and loading+validating the tenant's bundle at boot
(`GET /api/v1/catalog`, `GET /api/v1/branding` — no prices yet). **Not yet built**: price calculation
(VEN-6), quote persistence (VEN-8/9), PDF output (VEN-7), photorealistic rendering (VEN-10/11/12). The
`Quote`/`EndClient` Prisma models exist for the schema shape but have no endpoints yet.

## Coverage gate

CI runs `pnpm test:cov` and prints the summary, but does **not** fail the build below 85% yet — a
two-endpoint slice can't realistically hit that. Wire the hard threshold in `.github/workflows/ci.yml` once
enough vertical slices exist that 85% is a meaningful bar, not noise.

## Development

Requires Node 24 (`.nvmrc`) and pnpm.

```bash
cp .env.example .env          # point BUNDLE_PATH at a bundle Studio exported
pnpm install                  # also runs `prisma generate` (postinstall)
pnpm prisma:migrate:dev       # creates the SQLite file + schema
pnpm start:dev
```

```bash
pnpm lint
pnpm typecheck
pnpm test          # unit + integration (real SQLite, not mocked)
pnpm test:cov
pnpm test:e2e
```

## Docker

```bash
docker build -t pergolando-backend .
docker run -p 3001:3001 \
  -e DATABASE_URL="file:./data/db.sqlite" \
  -e BUNDLE_PATH="/app/bundle" \
  -v /path/to/tenant/bundle:/app/bundle:ro \
  -v pergolando_backend_data:/app/data \
  pergolando-backend
```

## Git Flow

`main` (releases) + `develop` (integration) + `feature/*`. PRs required into both.
