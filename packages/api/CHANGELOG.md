# Changelog

## 1.0.0 (2026-06-30)


### Features

* **api,ci:** e2e happy path + coverage gate + postgres ci service ([8a3656c](https://github.com/edcrove/recetario/commit/8a3656c038313148d2a56c22e36e488ad16d0c7a))
* **api,shared:** seed/demo data (3 recipes, idempotent script) ([08c409b](https://github.com/edcrove/recetario/commit/08c409b1f3209afdba776fc0fde806019bbcd5a6))
* **api:** api key auth middleware + in-memory rate limiting ([c694d39](https://github.com/edcrove/recetario/commit/c694d39119500706fb640e0a2137c256eb71a088))
* **api:** contract tests vs openapi/zod schema ([4d52f23](https://github.com/edcrove/recetario/commit/4d52f23668ee0349e17bf715a6a767d789ddfad6))
* **api:** drizzle schema + migrations (recipes/ingredients/steps/sources/api_keys) ([ee88957](https://github.com/edcrove/recetario/commit/ee8895713444efa3a04abdf70e9fd5d1212e1d9e))
* **api:** integration tests with testcontainers postgres ([8321659](https://github.com/edcrove/recetario/commit/8321659673ee26c705953352c9105f54e9c7ec7e))
* **api:** openAPI 3.1 + zod-openapi + swagger UI at /docs ([a1ef4a4](https://github.com/edcrove/recetario/commit/a1ef4a4379a8cc767c3c6ad411dcc1ee4154764a))
* **api:** recipe CRUD + search endpoints (POST/GET/PUT/DELETE /v1/recipes) ([d989168](https://github.com/edcrove/recetario/commit/d989168db6cfba43fd1d33895c61a5c59e909442))
* **quality:** add HTML coverage report deployed to GitHub Pages ([#11](https://github.com/edcrove/recetario/issues/11)) ([7696469](https://github.com/edcrove/recetario/commit/76964696c07d2978c0e4d8d71dc6cc481b843b2a))
* weekly menu & shopping list — backend + MCP ([#7](https://github.com/edcrove/recetario/issues/7)) ([2ff5d66](https://github.com/edcrove/recetario/commit/2ff5d6644af90a86708f3811977af9ea6aa30f73))


### Bug Fixes

* align 400/422 contract, wire homeScreen utils, suppress CodeQL false positives ([#26](https://github.com/edcrove/recetario/issues/26)) ([5b33719](https://github.com/edcrove/recetario/commit/5b33719f7e3a97317f90d2c75234b1ae64133468))
* **api:** correct migration path and test assertions in integration suite ([f971098](https://github.com/edcrove/recetario/commit/f971098e89234c22f05fd59f11e26174601afd94))
* **security:** patch drizzle-orm SQL injection and xmldom CVEs ([514986e](https://github.com/edcrove/recetario/commit/514986e761e4031f887f9be448aefcb506fe1ef6))
* **tooling:** resolve typecheck and test failures from Phase 0 scaffold ([2423ec3](https://github.com/edcrove/recetario/commit/2423ec3d85af40a44826f0c33d9254836ca63d24))
