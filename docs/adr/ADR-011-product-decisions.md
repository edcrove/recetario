# ADR-011 — Consolidated product decisions

**Status:** Accepted  
**Notion:** https://app.notion.com/p/7eeb7d9edad842c6b3024dfda4425db6

## Decision

Consolidates cross-cutting product decisions not covered by earlier ADRs:

- **Agent-first principle**: zero inference in the app; all AI via MCP client.
- **Public repo**: the codebase is a best-practices reference; code quality is a feature.
- **BYOK import** (Phase 3+): optional in-app AI import with bring-your-own-key; not in MVP.
- **Menu & shopping list** (Phase 2): `addToMenu` and `generateShoppingList` MCP tools.
- **Deduplication**: recipes upserted by `source` URL to avoid duplicates from repeated imports.
- **Semantic versioning**: packages versioned independently; API versioned via URL prefix (`/v1`).

## Context

These decisions emerged from product Q&A and consistency reviews documented in Notion Notes.

## Consequences

See individual ADRs (001–010) for implementation details of each area.
