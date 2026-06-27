# ADR-007 — Ingredient catalog & normalization

**Status:** Accepted  
**Notion:** https://app.notion.com/p/7eeb7d9edad842c6b3024dfda4425db6

## Decision

A shared canonical ingredient catalog normalizes ingredient names across recipes. The density table (mass↔volume conversions) lives here in Phase 2+, migrated from `packages/shared` where it starts as a stub in Phase 1.

## Context

Without normalization, "chicken breast" and "Chicken Breast" are different ingredients, breaking search and nutrition aggregation. A catalog provides canonical names, aliases, and density data.

## Consequences

- Phase 1: density table is a hardcoded stub in `packages/shared`.
- Phase 2: catalog becomes its own DB table; density data moves there.
- Ingredient creation during recipe import normalizes against the catalog.
