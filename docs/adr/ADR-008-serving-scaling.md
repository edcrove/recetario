# ADR-008 — Serving scaling & unit conversion

**Status:** Accepted  
**Notion:** https://app.notion.com/p/7eeb7d9edad842c6b3024dfda4425db6

## Decision

Scaling and unit conversion are pure functions in `packages/shared`, framework-agnostic, fully unit-tested. The Expo app applies scaling client-side without a server round-trip.

Supported conversions: metric ↔ imperial (mass and volume). Density table enables mass↔volume for known ingredients.

## Context

Scaling is display-only and deterministic — no reason to involve the server. Keeping it in `shared` means the same logic runs in the API (for validation) and the app (for display).

## Consequences

- `scaleQuantity(qty, fromServings, toServings)` in `shared`.
- `convertUnit(qty, fromUnit, toUnit, ingredient?)` in `shared`.
- The density table is a curated constant in Phase 1, moving to DB in Phase 2.
