# ADR-012 — Deployment hosting & family distribution

**Status:** Accepted  
**Notion:** https://app.notion.com/p/3a964048cc3581b684acf43c2e90f968

## Decision

Two routes, decided together because deploying the backend without a way to
reach the phones only solves half the problem.

- **API + database — Railway (~US$5/month).** The Hono/Node API and its Postgres
  run on Railway. Railway builds the API from source (Nixpacks buildpack), so the
  deploy does **not** depend on the container image — whose build is currently
  broken (tracked as its own backlog item). Managed Postgres with automated
  backups is included.
- **Family distribution — Expo Web as an installable PWA.** No app stores for v1.
  The web target (already first-class per [ADR-009](ADR-009-expo-web-and-mobile.md))
  is exported and served from a free static host (Cloudflare Pages / Netlify /
  Vercel); the family opens a URL and "Add to Home Screen." Updates ship the
  instant the site is redeployed.

## Context

This decision unblocks the entire product pillar: until it exists, nine finished
features live in a repo nobody can open.

Constraints (deliberately the opposite of the portfolio instinct):

- **Household scale** — ~4 real, non-technical users; optimise for near-zero
  _sustained_ cost and minimal operational surface, not for scalability.
- The API is a standard Node HTTP server (`@hono/node-server`) talking to Postgres
  (postgres.js + Drizzle), running migrations on boot.
- The app already builds and runs on the web — that is what the E2E suite drives.
- The database must be backup-able (feeds the backups + tested-restore story).

Distribution to a handful of non-technical users is the half that is usually
underestimated: TestFlight invites expire every 90 days, Android internal testing
needs a Play console, and EAS Update only works once a build is already installed.
Because the app is already a web app, the web/PWA route sidesteps all of it.

## Alternatives rejected

- **Neon (free Postgres) + Fly.io (API), ~US$0–3.** Genuinely near-zero and
  low-ops, but two platforms to coordinate and it leans on the container-build
  fix. Kept as the fallback if the ~US$5 ever matters.
- **Render free tier.** Web services spin down on idle (cold starts on a _used_
  app) and the free Postgres is deleted after 90 days — a trap for real users.
- **VPS (Hetzner ~€4).** Runs the existing `docker-compose` as-is with full
  control, but makes us the sysadmin — OS patching, security, backups — the
  highest operational surface of the options.
- **AWS free tier (EC2 + RDS, or Lightsail).** The free tier is 12 months only
  (and the 2025 credit-based model can expire in ~6 months for new accounts),
  reverting to ~US$25–30/month — not near-zero *sustained*. Raw EC2 is high-ops
  (VPC/IAM/patching), 1 GB micro is tight for Node + Postgres colocated, and there
  is no always-free Postgres path (Aurora Serverless min ~US$40/mo; DynamoDB would
  be a rewrite). It is precisely the portfolio instinct the constraints warn
  against.
- **Native distribution (TestFlight / Play internal / EAS Update).** Apple
  Developer at US$99/yr with 90-day-expiring TestFlight invites, Play Console at
  US$25, and EAS needing an installed build first — high friction and cost for
  four users when the app already runs on the web. Revisit only when a native-only
  capability is actually required.

## Consequences

- **Monthly cost: ~US$5** (Railway). Static web host: free.
- The API deploys from source via buildpack, so the broken Docker image build does
  not block deploy — but that build should still be fixed for CI parity and
  portability (its own backlog item).
- Railway's automated Postgres backups satisfy the DB-backup constraint; the
  _tested-restore_ story still stands on top of that.
- No app-store accounts and no native build pipeline in Phase 1 — consistent with
  ADR-009 ("no SSR in Phase 1; static web export").
- Provisioning is a separate story; this ADR records the decision only.
