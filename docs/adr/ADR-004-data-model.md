# ADR-004 — Data model & schema

**Status:** Accepted  
**Notion:** https://app.notion.com/p/7eeb7d9edad842c6b3024dfda4425db6

## Decision

Recipe schema defined in `packages/shared` with Zod. Drizzle ORM mirrors the schema for Postgres. Single source of truth: Zod → TypeScript types + runtime validation + OpenAPI schema.

Core entities: `Recipe`, `Ingredient`, `Step`. Recipes are deduplicated/upserted by `source` URL.

## Context

Zod-first means validation, types, and API contract all derive from one definition — no drift between what the API accepts and what the DB stores.

## Consequences

- `@hono/zod-openapi` generates OpenAPI 3.1 from the same Zod schemas.
- Drizzle migrations are generated from `packages/api/src/db/schema/`.
- Adding a field requires updating the Zod schema, the Drizzle schema, and regenerating the migration.
