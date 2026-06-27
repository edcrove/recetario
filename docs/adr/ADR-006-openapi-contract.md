# ADR-006 — OpenAPI contract generation

**Status:** Accepted  
**Notion:** https://app.notion.com/p/7eeb7d9edad842c6b3024dfda4425db6

## Decision

Use `@hono/zod-openapi` to generate OpenAPI 3.1 spec at runtime from Zod route definitions. Swagger UI served at `/docs`. Contract tests run against the live spec on every CI run.

## Context

Hand-written OpenAPI specs drift from implementation. Generating from the same Zod schemas used for validation eliminates that class of bug.

## Consequences

- Every route must be defined with `createRoute()` from `@hono/zod-openapi`.
- The generated spec is the contract — no separate spec file to maintain.
- SDK generation (for typed clients) is possible from the spec.
