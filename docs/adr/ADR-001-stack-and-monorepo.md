# ADR-001 — Stack & monorepo

**Status:** Accepted  
**Notion:** https://app.notion.com/p/7eeb7d9edad842c6b3024dfda4425db6

## Decision

pnpm workspaces + Turborepo monorepo with Node 22 LTS. Packages: `shared` (domain), `api` (Hono), `mcp` (MCP server). App: `apps/app` (Expo). TypeScript strict everywhere.

## Context

Single repo enables sharing domain logic and types across API, MCP server, and Expo app without publishing to npm. Turborepo provides incremental task execution and caching.

## Consequences

- All packages share `tsconfig.base.json`, ESLint config, and Prettier.
- `pnpm turbo run build/test/lint` runs across the graph respecting dependency order.
- Adding a new package requires wiring it into `pnpm-workspace.yaml` and `turbo.json`.
