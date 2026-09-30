# ADR-010 — Nutrition data: per-recipe, per-serving, agent-supplied

**Status:** Accepted (rewritten 2026-09-30 to match what was built; supersedes the original
"USDA/OFF per ingredient" proposal)  
**Notion:** https://app.notion.com/p/38a64048cc35813a8efdd8e27c3fe4c1

## Decision

Nutrition is stored **per recipe, per serving** in `recipes.nutrition` (jsonb:
`calories`, `protein_g`, `carbs_g`, `fat_g`, optional `fiber_g`). Values are supplied by
the MCP agent (from its own knowledge or an imported page's schema.org markup) or entered
manually. The app and API never compute nutrition from ingredients; they only scale the
per-serving values linearly by servings eaten.

## Context

The original proposal (June 2026) was to source nutrition from USDA FoodData Central and
Open Food Facts, stored per ingredient in the catalog and enriched through an MCP
`updateIngredient` tool. None of that was built: the ingredient catalog has no nutrition
columns and no USDA/OFF integration exists. Agent-first (ADR-002) made per-recipe values
from the agent the cheaper path, and it is what every screen, the day-nutrition rollup and
the suggestions ranking use today.

## Consequences

- Accuracy depends on the agent/import. There is no ingredient-level recomputation, so a
  servings-only change or an ingredient edit does not update nutrition (see the
  2026-09-30 audit backlog: warn/clear on servings change, Atwater sanity check).
- Per-ingredient nutrition (USDA/OFF) remains a possible future ADR if accuracy matters;
  it would require catalog columns, licensing/attribution and a recompute path.
- The MCP `createRecipe`/`updateRecipe` tools document nutrition as "per serving, not per
  whole recipe", and the day rollup multiplies by servings.
