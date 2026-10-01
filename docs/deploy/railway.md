# Deploying the API to Railway

How the Recetario API and its Postgres run on Railway ([ADR-012](../adr/ADR-012-deployment-hosting-and-distribution.md)),
written so the whole setup can be rebuilt from scratch. The app (PWA) is a separate story.

## What the repo provides

| Piece                | Where                                                 | What it does                                                                                                               |
| -------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Build + start config | `railway.json` (repo root)                            | Nixpacks build of `shared` + `api`; start = `start:prod`; health check `/health`                                           |
| Release step         | `packages/api/src/scripts/release.ts`                 | On every start: apply Drizzle migrations, then seed system taxonomy + ingredient catalog (idempotent, **no demo recipes**) |
| Startup guard        | `packages/api/src/config/production.ts`               | With `NODE_ENV=production`, refuses to start on a placeholder/short `JWT_SECRET` or any `DEV_API_KEY`                      |
| Closed sign-up       | same file, `registrationOpen()`                       | `POST /auth/register` returns 403 in production unless `REGISTRATION_OPEN=true`                                            |
| Password reset       | `pnpm --filter @recetario/api reset-password <email>` | Prints a temporary password (no email provider yet)                                                                        |

## Build from scratch

1. **Project**: Railway → New Project → Deploy from GitHub repo → `edcrove/recetario`
   (branch `main`). Leave the root directory as the repo root: `railway.json` is picked up.
2. **Database**: in the project, New → Database → PostgreSQL. Railway exposes it to other
   services as `${{Postgres.DATABASE_URL}}`.
3. **API service variables** (Variables tab):

   | Variable       | Value                                                                                |
   | -------------- | ------------------------------------------------------------------------------------ |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}`                                                         |
   | `NODE_ENV`     | `production`                                                                         |
   | `JWT_SECRET`   | output of `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
   | `TRUST_PROXY`  | `true` — Railway's proxy sets X-Forwarded-For; the auth rate limit keys on it        |
   | `CORS_ORIGIN`  | the PWA's URL once it exists (comma-separated list)                                  |

   Do **not** set `DEV_API_KEY` or `ALLOW_DEV_SECRETS` (the API refuses to start or
   runs insecurely). Railway sets `PORT` itself.

4. **Domain**: Settings → Networking → Generate Domain. HTTPS is automatic.
5. **Deploy** and check the logs: `Applying migrations…`, `Taxonomy + ingredients seeded.`,
   `API running`. Then `curl https://<domain>/health` → `{"status":"ok"}`.

## Opening accounts for the family

Sign-up is closed by default. Either:

- set `REGISTRATION_OPEN=true`, let everyone register from the app, then delete the
  variable (Railway redeploys), or
- register them yourself while it is open, and hand out passwords.

Forgotten password: run the reset script against the Railway database from your machine
(`DATABASE_URL` from the Postgres service's _Connect_ tab, public URL):

```bash
DATABASE_URL='postgresql://…' pnpm --filter @recetario/api reset-password someone@example.com
```

## MCP agents

Generate an API key (`pnpm --filter @recetario/api generate-key`), insert its hash into
`api_keys` for the owner's user id, and point the MCP server at the deployed API
(`API_BASE_URL=https://<domain>`, `MCP_API_KEY=<key>`).

## Smoke check (Definition of Done)

From a phone, log in against the deployed API, create a recipe, reload, and confirm it
comes back. Record the date here when done.

## Known limits

- Rate limits are in memory: fine for one instance; revisit before scaling out
  (decision log D-2026-09-30-10).
- Backups: see the backups story (Railway Postgres snapshots + a tested restore).
- There is no CI deploy pipeline on purpose: deploy by hand first, automate later.
