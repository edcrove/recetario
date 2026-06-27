# ADR-003 — Testing strategy

**Status:** Accepted  
**Notion:** https://app.notion.com/p/7eeb7d9edad842c6b3024dfda4425db6

## Decision

Four-layer pyramid: Unit → Integration → Contract → E2E.

- **Unit** (`packages/shared`): pure domain logic, no I/O, Vitest.
- **Integration** (`packages/api`): Hono `app.request()` against real Postgres via Testcontainers.
- **Contract**: responses validated against the OpenAPI/Zod schema on every run.
- **E2E**: Playwright on the Expo web build; React Native Testing Library for components.

## Context

Mocking the database was ruled out after prior incidents where mock/prod divergence masked real failures. Testcontainers spins up a real Postgres in CI with no external dependencies.

## Consequences

- CI requires Docker (for Testcontainers).
- Each package runs its own Vitest suite; `turbo run test` orchestrates them.
- Coverage gates enforced in CI.
