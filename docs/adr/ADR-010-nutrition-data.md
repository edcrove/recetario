# ADR-010 — Nutrition data (USDA/OFF + manual + MCP)

**Status:** Accepted  
**Notion:** https://app.notion.com/p/7eeb7d9edad842c6b3024dfda4425db6

## Decision

Nutrition data sourced from USDA FoodData Central and Open Food Facts (OFF), supplemented by manual entries and MCP-agent enrichment. Stored per ingredient in the catalog (Phase 2+).

## Context

Public nutrition databases cover most common ingredients. Gaps filled by the MCP agent (which can query external sources) or manual entry. Phase 1 has no nutrition features.

## Consequences

- Phase 1: no nutrition data.
- Phase 2: nutrition fields added to ingredient catalog via migration.
- MCP agent can enrich ingredients with nutrition data via `updateIngredient` tool.
