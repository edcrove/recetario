# Changelog

## [0.2.0](https://github.com/edcrove/recetario/compare/shared-v0.1.0...shared-v0.2.0) (2026-07-02)


### Features

* **api,ci:** e2e happy path + coverage gate + postgres ci service ([8a3656c](https://github.com/edcrove/recetario/commit/8a3656c038313148d2a56c22e36e488ad16d0c7a))
* **api,shared:** seed/demo data (3 recipes, idempotent script) ([08c409b](https://github.com/edcrove/recetario/commit/08c409b1f3209afdba776fc0fde806019bbcd5a6))
* dietary filters, nutrition macros, menu balancing — full stack (stories 431-433,451-453,461-463) ([#42](https://github.com/edcrove/recetario/issues/42)) ([efbc357](https://github.com/edcrove/recetario/commit/efbc357653e625a958fb9a488290dc2729911740))
* **identity:** users, auth, JWT middleware, secrets management ([#31](https://github.com/edcrove/recetario/issues/31)) ([b03415c](https://github.com/edcrove/recetario/commit/b03415c08f5d27ffff85fb29bb33ea8f8aefe72b))
* multiple recipes per meal slot with per-recipe servings ([#408](https://github.com/edcrove/recetario/issues/408)) ([#45](https://github.com/edcrove/recetario/issues/45)) ([ae2aaf6](https://github.com/edcrove/recetario/commit/ae2aaf67c402eb78f8798cf1dbd2bfb592821b34))
* **quality:** add HTML coverage report deployed to GitHub Pages ([#11](https://github.com/edcrove/recetario/issues/11)) ([7696469](https://github.com/edcrove/recetario/commit/76964696c07d2978c0e4d8d71dc6cc481b843b2a))
* **shared:** density table + volume↔mass conversion ([18d3113](https://github.com/edcrove/recetario/commit/18d3113d337416ab4f13d411b26d354214a3f785))
* **shared:** recipe/ingredient/step/source Zod schema + types ([92b795e](https://github.com/edcrove/recetario/commit/92b795ee6d74b087cd46eb765a863f240bdfa3f8))
* **shared:** scaleQuantity pure function + unit tests ([d2b14a5](https://github.com/edcrove/recetario/commit/d2b14a546f8243d6ef4adcd3497d9e655b7eb87f))
* **shared:** within-dimension unit conversion (volume + mass) ([d34e8fe](https://github.com/edcrove/recetario/commit/d34e8fe5aee21baf8b4a64c594c9ffb6f10ce00e))
* weekly menu & shopping list — backend + MCP ([#7](https://github.com/edcrove/recetario/issues/7)) ([2ff5d66](https://github.com/edcrove/recetario/commit/2ff5d6644af90a86708f3811977af9ea6aa30f73))


### Bug Fixes

* **app,shared:** spanish unit labels + filter zero-qty shopping list items ([b74121e](https://github.com/edcrove/recetario/commit/b74121e04fae9b2d99fa1d08cc0ab707257f717a))
* **ci:** resolve all PR [#36](https://github.com/edcrove/recetario/issues/36) warnings — unused vars, CodeQL v4, actions node24 ([#37](https://github.com/edcrove/recetario/issues/37)) ([8dc96d2](https://github.com/edcrove/recetario/commit/8dc96d2fa931e234d5c00a71abdd94b4e067b762))
