# Changelog

## [0.3.0](https://github.com/edcrove/recetario/compare/shared-v0.2.0...shared-v0.3.0) (2026-07-13)


### Features

* **app:** tiempos/dificultad en form, cards y filtros ([f2e4123](https://github.com/edcrove/recetario/commit/f2e4123d04b20bf09febf9024978c95e4aea021f))
* auto-detected step timers (durationSeconds + tap-to-start) ([47662b9](https://github.com/edcrove/recetario/commit/47662b917af5090873a52e1d7c138f72f1a18611))
* auto-detected step timers (durationSeconds + tap-to-start) ([1a43aa0](https://github.com/edcrove/recetario/commit/1a43aa069e995d9b1fadc05743dbf16d1c9aaaa3))


### Bug Fixes

* **app:** allow clearing recipe time/difficulty on edit (explicit null) ([0f80ff3](https://github.com/edcrove/recetario/commit/0f80ff33265d9fb73aa6af11c4a4d894dc7099d9))
* **shared:** bound digit runs in step-duration regex (ReDoS) ([533b857](https://github.com/edcrove/recetario/commit/533b8573f30c1470e9cc3a8dcb6b2705f563feca))

## [0.2.0](https://github.com/edcrove/recetario/compare/shared-v0.1.0...shared-v0.2.0) (2026-07-12)


### Features

* **api,ci:** e2e happy path + coverage gate + postgres ci service ([8a3656c](https://github.com/edcrove/recetario/commit/8a3656c038313148d2a56c22e36e488ad16d0c7a))
* **api,shared:** seed/demo data (3 recipes, idempotent script) ([08c409b](https://github.com/edcrove/recetario/commit/08c409b1f3209afdba776fc0fde806019bbcd5a6))
* **api:** day nutrition rollup + per-meal goals schema (nutrition epic 1+2) ([0864bc4](https://github.com/edcrove/recetario/commit/0864bc48a3917f6e8b9fd232d7e168eb373657e1))
* **api:** day nutrition rollup with signed delta + per-meal goals schema ([821f9b5](https://github.com/edcrove/recetario/commit/821f9b5ea8f8c19a9dead3e7d7b39b7f1e362513))
* **api:** menu gap — what's missing to cook the planned week ([f357b77](https://github.com/edcrove/recetario/commit/f357b777df241b93200d40c82981303d01d2545e))
* **api:** menu gap — what's missing to cook the planned week ([40e6669](https://github.com/edcrove/recetario/commit/40e66699909b8e3a4082648626b34d3150db7837))
* **api:** public library endpoint + copy-as-fork endpoint ([25f1171](https://github.com/edcrove/recetario/commit/25f1171b9984111a5428d34c13bc40fabefd237d))
* **api:** public library endpoint + copy-as-fork endpoint ([3dbf549](https://github.com/edcrove/recetario/commit/3dbf5491bb799050501936906d9d71b62ff0bc76))
* **api:** recipe difficulty + list filters (maxTotalTime, difficulty) ([5e7e1c6](https://github.com/edcrove/recetario/commit/5e7e1c6bcba2fb4628862aa344f4249210b8a0ba))
* **api:** recipe difficulty + list filters (maxTotalTime, difficulty) ([e8ecdb6](https://github.com/edcrove/recetario/commit/e8ecdb683eb358a90bb7168132e764f140d35190))
* **api:** recipe suggestions from ingredients with goal fit ([8354892](https://github.com/edcrove/recetario/commit/83548924c1b50b2083a978ebab66b6c626fbfe54))
* **api:** recipe suggestions from ingredients with goal fit ([c7b43e0](https://github.com/edcrove/recetario/commit/c7b43e02c64b17bbeec1e5b151d6c18a80fd9dfa))
* **api:** recipe visibility + fork provenance schema ([0cabe71](https://github.com/edcrove/recetario/commit/0cabe71e721f6f5eb2591bd3e0b4e3fb001470b8))
* **api:** recipe visibility + fork provenance schema ([12e722f](https://github.com/edcrove/recetario/commit/12e722f2f1310df45ec29b6ca5fd068be78c8d98))
* **app:** ¿Qué hay en la heladera? screen ([3d3cf16](https://github.com/edcrove/recetario/commit/3d3cf16f6d450322c95755a8d8c0af1d2a535f9a))
* **app:** ¿Qué hay en la heladera? screen ([3358d68](https://github.com/edcrove/recetario/commit/3358d68a110053a706af903c2f8f447f5c232d60))
* **app:** sharing UI — Biblioteca, visibility toggle, provenance, role-aware affordances ([0a148f1](https://github.com/edcrove/recetario/commit/0a148f12ecfaa4dd529b445ad81f893dd2d068d5))
* **app:** sharing UI — Biblioteca, visibility toggle, provenance, role-aware affordances ([e7e8492](https://github.com/edcrove/recetario/commit/e7e84929ca95b2c2eb7cc8f2f03a8f134f47522b))
* dietary filters, nutrition macros, menu balancing — full stack (stories 431-433,451-453,461-463) ([#42](https://github.com/edcrove/recetario/issues/42)) ([efbc357](https://github.com/edcrove/recetario/commit/efbc357653e625a958fb9a488290dc2729911740))
* **e2e:** critical flows + 100% pass rate + testID + coverage pipeline (story 473) ([b9d854f](https://github.com/edcrove/recetario/commit/b9d854fc470ca536d6b596728e4b148808fa5469))
* **identity:** users, auth, JWT middleware, secrets management ([#31](https://github.com/edcrove/recetario/issues/31)) ([b03415c](https://github.com/edcrove/recetario/commit/b03415c08f5d27ffff85fb29bb33ea8f8aefe72b))
* **import:** recipe import via mcp fetch tool + source provenance ([a88f702](https://github.com/edcrove/recetario/commit/a88f70276ceddc0bc7332022b6a260c28feab41f))
* **import:** recipe import via MCP fetch tool + source provenance ([aa7a297](https://github.com/edcrove/recetario/commit/aa7a297a667a68393d0fc4141f573739f0daba52))
* **ingredients:** canonical/synonym/family model + normalizer + es-AR seed ([8b62281](https://github.com/edcrove/recetario/commit/8b62281058aa5304c741b238909f3c71a198bd29))
* **ingredients:** canonical/synonym/family model + normalizer + es-AR seed ([0a039ea](https://github.com/edcrove/recetario/commit/0a039ea611846ef737959ab78f1f300144a3974c))
* **ingredients:** resolve shopping + allergens through canonicals ([27ae7e0](https://github.com/edcrove/recetario/commit/27ae7e02a771951c088830beae97459cb2cdbfc3))
* **ingredients:** resolve shopping list + allergens through canonicals ([5a87c05](https://github.com/edcrove/recetario/commit/5a87c050f29056731e6462d5a5337459b0c6c67f))
* **mcp:** update_pantry + what_can_i_cook ([f586ab4](https://github.com/edcrove/recetario/commit/f586ab427e66c1bdfe8c031baad9732b7bce92c6))
* **mcp:** update_pantry + what_can_i_cook ([3ebc7d1](https://github.com/edcrove/recetario/commit/3ebc7d188f1df75cf4d4d0c47f884ba071041b9b))
* multiple recipes per meal slot with per-recipe servings ([#408](https://github.com/edcrove/recetario/issues/408)) ([#45](https://github.com/edcrove/recetario/issues/45)) ([ae2aaf6](https://github.com/edcrove/recetario/commit/ae2aaf67c402eb78f8798cf1dbd2bfb592821b34))
* **pantry:** shopping list flags items already in the pantry ([447d76d](https://github.com/edcrove/recetario/commit/447d76dee289b70057e50278160261db2ca3375d))
* **pantry:** shopping list flags items already in the pantry ([6521a0c](https://github.com/edcrove/recetario/commit/6521a0cbf6e0519dcf7287bf52707586ec6f36f8))
* persist foodTypeIds/nutrition/dietaryTags end-to-end + allergen badge in picker ([2005a24](https://github.com/edcrove/recetario/commit/2005a24686c9905a0bf5205e131592c3fb9d6adf))
* **quality:** add HTML coverage report deployed to GitHub Pages ([#11](https://github.com/edcrove/recetario/issues/11)) ([7696469](https://github.com/edcrove/recetario/commit/76964696c07d2978c0e4d8d71dc6cc481b843b2a))
* **shared:** density table + volume↔mass conversion ([18d3113](https://github.com/edcrove/recetario/commit/18d3113d337416ab4f13d411b26d354214a3f785))
* **shared:** recipe/ingredient/step/source Zod schema + types ([92b795e](https://github.com/edcrove/recetario/commit/92b795ee6d74b087cd46eb765a863f240bdfa3f8))
* **shared:** scaleQuantity pure function + unit tests ([d2b14a5](https://github.com/edcrove/recetario/commit/d2b14a546f8243d6ef4adcd3497d9e655b7eb87f))
* **shared:** within-dimension unit conversion (volume + mass) ([d34e8fe](https://github.com/edcrove/recetario/commit/d34e8fe5aee21baf8b4a64c594c9ffb6f10ce00e))
* **shopping:** combine, aisle-group and persist checks (api+shared) ([5ebdf53](https://github.com/edcrove/recetario/commit/5ebdf530b4f6572b2cdde19c487f8bfe93c1a685))
* **shopping:** smart shopping list v2 — combine, aisle-group, persistent check-off ([0cb58c6](https://github.com/edcrove/recetario/commit/0cb58c646b276ce874dbc668adfe861f586d2882))
* weekly menu & shopping list — backend + MCP ([#7](https://github.com/edcrove/recetario/issues/7)) ([2ff5d66](https://github.com/edcrove/recetario/commit/2ff5d6644af90a86708f3811977af9ea6aa30f73))


### Bug Fixes

* **api:** preserve cook history and menu entries when a recipe is deleted ([f42246b](https://github.com/edcrove/recetario/commit/f42246b569adcc76705ce90c11bb4ccb128b5894))
* **app,shared:** spanish unit labels + filter zero-qty shopping list items ([b74121e](https://github.com/edcrove/recetario/commit/b74121e04fae9b2d99fa1d08cc0ab707257f717a))
* **ci:** resolve all PR [#36](https://github.com/edcrove/recetario/issues/36) warnings — unused vars, CodeQL v4, actions node24 ([#37](https://github.com/edcrove/recetario/issues/37)) ([8dc96d2](https://github.com/edcrove/recetario/commit/8dc96d2fa931e234d5c00a71abdd94b4e067b762))
* **e2e:** resolve 2 fixme tests — chip modal now testable via testID ([fb2a018](https://github.com/edcrove/recetario/commit/fb2a018882d505ba1f9e7939d90520d8ae59d220))
* remediate 11-agent audit findings (IDOR, data loss, missing screens) ([63571d5](https://github.com/edcrove/recetario/commit/63571d50095ea48ffb7d6846ddfdc67fe4e60a06))
* **shared:** linear tag regexes in recipe parser (codeql) ([0492cd8](https://github.com/edcrove/recetario/commit/0492cd8bc79db628b538e5db30ce8355cdd5ec3d))
* **shared:** tolerate junk in script/style close tags (codeql) ([f6a78ff](https://github.com/edcrove/recetario/commit/f6a78ff9375ee91432e696ec9fff19b7270943c2))
