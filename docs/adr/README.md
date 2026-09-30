# Architecture Decision Records

ADRs are maintained in Notion: https://app.notion.com/p/7eeb7d9edad842c6b3024dfda4425db6

Each file here mirrors one ADR for offline reference.

> **Known drift (2026-09-30):** the Notion database numbers ADRs differently from these
> files (e.g. Notion #4 "Agent-first product", #9 "CI/CD execution model" have no file
> here, and files 006/008/009 have no Notion row), and Notion lists "Nutrition data source"
> as _Proposed_ while ADR-010 here says _Accepted_. Reconciling them is the backlog task
> "docs: relocate the test plan and ADRs into the repo, stub them in Notion".

| ID                                                        | Title                                    | Status   |
| --------------------------------------------------------- | ---------------------------------------- | -------- |
| [ADR-001](ADR-001-stack-and-monorepo.md)                  | Stack & monorepo                         | Accepted |
| [ADR-002](ADR-002-api-first-and-mcp.md)                   | API-first + MCP primary write path       | Accepted |
| [ADR-003](ADR-003-testing-strategy.md)                    | Testing strategy                         | Accepted |
| [ADR-004](ADR-004-data-model.md)                          | Data model & schema                      | Accepted |
| [ADR-005](ADR-005-identity-and-auth.md)                   | Identity & auth (API keys)               | Accepted |
| [ADR-006](ADR-006-openapi-contract.md)                    | OpenAPI contract generation              | Accepted |
| [ADR-007](ADR-007-ingredient-catalog.md)                  | Ingredient catalog & normalization       | Accepted |
| [ADR-008](ADR-008-serving-scaling.md)                     | Serving scaling & unit conversion        | Accepted |
| [ADR-009](ADR-009-expo-web-and-mobile.md)                 | Expo for web + mobile                    | Accepted |
| [ADR-010](ADR-010-nutrition-data.md)                      | Nutrition data (USDA/OFF)                | Accepted |
| [ADR-011](ADR-011-product-decisions.md)                   | Consolidated product decisions           | Accepted |
| [ADR-012](ADR-012-deployment-hosting-and-distribution.md) | Deployment hosting & family distribution | Accepted |
