# Recetario — Agent Guidance

## Project

Recetario is an **agent-first** recipe management application built as a pnpm monorepo. The primary write path runs through MCP (Model Context Protocol): an AI agent calls tools exposed by `@recetario/mcp`, which in turn calls the Hono REST API (`@recetario/api`), which writes to PostgreSQL via Drizzle ORM. The mobile/web app (`recetario-app`, powered by Expo + React Native) is a **read-only consumer** of the API — it performs no LLM inference. All intelligence lives at the MCP layer.

## Monorepo layout

| Path | Package | Role |
|---|---|---|
| `packages/shared` | `@recetario/shared` | Domain types, constants, utilities shared across all packages |
| `packages/api` | `@recetario/api` | Hono REST API; reads/writes Postgres via Drizzle |
| `packages/mcp` | `@recetario/mcp` | MCP server; exposes agent tools that call the API |
| `apps/app` | `recetario-app` | Expo (React Native + Web) app; read-only UI |

## Key commands

```bash
# Development
pnpm dev                        # Start all packages in watch mode (turbo)
pnpm --filter @recetario/api dev        # Start only the API

# Build
pnpm build                      # Build all packages (turbo)

# Lint & format
pnpm lint                       # ESLint across all packages
npx prettier --check .          # Check formatting
npx prettier --write .          # Fix formatting

# Tests
pnpm test                       # Run all Vitest suites (turbo)

# Type checking
pnpm typecheck                  # tsc --noEmit across all packages (turbo)

# Database
docker compose up -d            # Start Postgres 17
pnpm --filter @recetario/api exec drizzle-kit generate   # Generate migrations
pnpm --filter @recetario/api exec drizzle-kit migrate    # Apply migrations
pnpm --filter @recetario/api exec drizzle-kit studio     # Open Drizzle Studio
```

## Agent-first principle

> The app does **no inference**. Zero.

All AI interactions flow through the MCP server:

```
Agent (Claude / GPT / etc.)
  └─► MCP tools (@recetario/mcp)
        └─► REST API (@recetario/api)
              └─► PostgreSQL (Drizzle ORM)
```

The Expo app reads data from the API like any other REST client. It never calls an LLM directly.

## Conventions

- **Commits**: Conventional Commits (`feat`, `fix`, `chore`, `docs`, etc.). Enforced by commitlint + husky.
- **Branch naming**: `feat/<story-slug>`, `fix/<issue>`, `chore/<task>`.
- **Stories**: One focused commit per story. Include the Notion story URL in the commit body.
- **TypeScript**: Strict mode everywhere (`strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`).
- **Tests**: Vitest for all unit/integration tests. No Jest.
- **Formatting**: Prettier 3 with the project `.prettierrc.json`. Run before every commit.

## Notion

Stories and the project roadmap live at:
https://app.notion.com/p/3d20a1ab4ba245bca87a2aaa11c4b278

Update the **Status** field on a story when you start and finish working on it.
