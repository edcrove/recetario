# ADR-002 — API-first + MCP primary write path

**Status:** Accepted  
**Notion:** https://app.notion.com/p/7eeb7d9edad842c6b3024dfda4425db6

## Decision

The public REST API (Hono + `@hono/zod-openapi`) is the single source of truth for all data operations. The MCP server is a thin layer over the API — it exposes agent tools (`createRecipe`, `getRecipe`, `searchRecipes`, `listRecipes`, `updateRecipe`, `deleteRecipe`) that call the API. The Expo app is also a consumer of the API and does no inference.

## Context

Keeping the MCP server thin over a real HTTP API means: the API is independently testable, documentable (OpenAPI), and usable by non-MCP clients. All intelligence stays in the MCP client (the agent the user already has).

## Consequences

- One validated, documented public API for all consumers.
- MCP server has no business logic — it translates tool calls to HTTP requests.
- The app pays zero inference cost.
- API keys required for all write operations.
