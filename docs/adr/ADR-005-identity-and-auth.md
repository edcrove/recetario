# ADR-005 — Identity & auth (API keys)

**Status:** Accepted  
**Notion:** https://app.notion.com/p/7eeb7d9edad842c6b3024dfda4425db6

## Decision

Phase 1: API-key-per-user authentication via `Authorization: Bearer <key>` header. Keys are stored hashed in Postgres. Rate limiting applied per key.

Phase 2+: Full accounts + households may warrant sessions/OAuth — tracked in a future ADR.

## Context

API keys are simple to implement, easy to use from MCP clients, and sufficient for the MVP where the primary consumer is an agent acting on behalf of one user.

## Consequences

- All write endpoints require a valid API key.
- Keys are generated server-side and shown once.
- The Expo app uses the same key mechanism for manual CRUD.
