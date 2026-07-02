# Changelog

## [0.2.0](https://github.com/edcrove/recetario/compare/api-v0.1.0...api-v0.2.0) (2026-07-02)


### Features

* **api,ci:** e2e happy path + coverage gate + postgres ci service ([8a3656c](https://github.com/edcrove/recetario/commit/8a3656c038313148d2a56c22e36e488ad16d0c7a))
* **api,mcp,app:** taxonomy configurator UI and API (stories 521-527) ([#40](https://github.com/edcrove/recetario/issues/40)) ([851ca43](https://github.com/edcrove/recetario/commit/851ca4319cedd95db7aff18944280a832acc6489))
* **api,mcp:** cook session history API and MCP tools (stories 502-503) ([#35](https://github.com/edcrove/recetario/issues/35)) ([33f9c6d](https://github.com/edcrove/recetario/commit/33f9c6de5855f46ad7e0f65af963afbe40cee626))
* **api,mcp:** taxonomy API and MCP tools — food types, collections, relations (stories 511-513) ([#38](https://github.com/edcrove/recetario/issues/38)) ([26da2bb](https://github.com/edcrove/recetario/commit/26da2bb62891de28003f1f788706eba78c8c7f3a))
* **api,shared:** seed/demo data (3 recipes, idempotent script) ([08c409b](https://github.com/edcrove/recetario/commit/08c409b1f3209afdba776fc0fde806019bbcd5a6))
* **api:** api key auth middleware + in-memory rate limiting ([c694d39](https://github.com/edcrove/recetario/commit/c694d39119500706fb640e0a2137c256eb71a088))
* **api:** contract tests vs openapi/zod schema ([4d52f23](https://github.com/edcrove/recetario/commit/4d52f23668ee0349e17bf715a6a767d789ddfad6))
* **api:** drizzle schema + migrations (recipes/ingredients/steps/sources/api_keys) ([ee88957](https://github.com/edcrove/recetario/commit/ee8895713444efa3a04abdf70e9fd5d1212e1d9e))
* **api:** integration tests with testcontainers postgres ([8321659](https://github.com/edcrove/recetario/commit/8321659673ee26c705953352c9105f54e9c7ec7e))
* **api:** openAPI 3.1 + zod-openapi + swagger UI at /docs ([a1ef4a4](https://github.com/edcrove/recetario/commit/a1ef4a4379a8cc767c3c6ad411dcc1ee4154764a))
* **api:** recipe CRUD + search endpoints (POST/GET/PUT/DELETE /v1/recipes) ([d989168](https://github.com/edcrove/recetario/commit/d989168db6cfba43fd1d33895c61a5c59e909442))
* dietary filters, nutrition macros, menu balancing — full stack (stories 431-433,451-453,461-463) ([#42](https://github.com/edcrove/recetario/issues/42)) ([efbc357](https://github.com/edcrove/recetario/commit/efbc357653e625a958fb9a488290dc2729911740))
* **identity:** profile endpoints, households API, MCP identity tools (stories 396-397, 401) ([#32](https://github.com/edcrove/recetario/issues/32)) ([5bd31e9](https://github.com/edcrove/recetario/commit/5bd31e91ba9dd0e9f8ecb30f655816b9a78b7667))
* **identity:** users, auth, JWT middleware, secrets management ([#31](https://github.com/edcrove/recetario/issues/31)) ([b03415c](https://github.com/edcrove/recetario/commit/b03415c08f5d27ffff85fb29bb33ea8f8aefe72b))
* **infra:** docker compose full stack + CORS for any localhost port ([3f0cda9](https://github.com/edcrove/recetario/commit/3f0cda9abb58185c7eec234032fde864a468aeeb))
* multiple recipes per meal slot with per-recipe servings ([#408](https://github.com/edcrove/recetario/issues/408)) ([#45](https://github.com/edcrove/recetario/issues/45)) ([ae2aaf6](https://github.com/edcrove/recetario/commit/ae2aaf67c402eb78f8798cf1dbd2bfb592821b34))
* **quality:** add HTML coverage report deployed to GitHub Pages ([#11](https://github.com/edcrove/recetario/issues/11)) ([7696469](https://github.com/edcrove/recetario/commit/76964696c07d2978c0e4d8d71dc6cc481b843b2a))
* weekly menu & shopping list — backend + MCP ([#7](https://github.com/edcrove/recetario/issues/7)) ([2ff5d66](https://github.com/edcrove/recetario/commit/2ff5d6644af90a86708f3811977af9ea6aa30f73))


### Bug Fixes

* align 400/422 contract, wire homeScreen utils, suppress CodeQL false positives ([#26](https://github.com/edcrove/recetario/issues/26)) ([5b33719](https://github.com/edcrove/recetario/commit/5b33719f7e3a97317f90d2c75234b1ae64133468))
* **api:** correct migration path and test assertions in integration suite ([f971098](https://github.com/edcrove/recetario/commit/f971098e89234c22f05fd59f11e26174601afd94))
* **ci:** resolve all PR [#36](https://github.com/edcrove/recetario/issues/36) warnings — unused vars, CodeQL v4, actions node24 ([#37](https://github.com/edcrove/recetario/issues/37)) ([8dc96d2](https://github.com/edcrove/recetario/commit/8dc96d2fa931e234d5c00a71abdd94b4e067b762))
* **security:** patch drizzle-orm SQL injection and xmldom CVEs ([514986e](https://github.com/edcrove/recetario/commit/514986e761e4031f887f9be448aefcb506fe1ef6))
* **tooling:** resolve typecheck and test failures from Phase 0 scaffold ([2423ec3](https://github.com/edcrove/recetario/commit/2423ec3d85af40a44826f0c33d9254836ca63d24))
