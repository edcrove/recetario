# Changelog

## [0.2.0](https://github.com/edcrove/recetario/compare/mcp-v0.1.0...mcp-v0.2.0) (2026-07-12)


### Features

* **api,mcp,app:** taxonomy configurator UI and API (stories 521-527) ([#40](https://github.com/edcrove/recetario/issues/40)) ([851ca43](https://github.com/edcrove/recetario/commit/851ca4319cedd95db7aff18944280a832acc6489))
* **api,mcp:** cook session history API and MCP tools (stories 502-503) ([#35](https://github.com/edcrove/recetario/issues/35)) ([33f9c6d](https://github.com/edcrove/recetario/commit/33f9c6de5855f46ad7e0f65af963afbe40cee626))
* **api,mcp:** taxonomy API and MCP tools — food types, collections, relations (stories 511-513) ([#38](https://github.com/edcrove/recetario/issues/38)) ([26da2bb](https://github.com/edcrove/recetario/commit/26da2bb62891de28003f1f788706eba78c8c7f3a))
* **coverage:** 100% coverage thresholds for MCP and app utils ([259af14](https://github.com/edcrove/recetario/commit/259af14bcfe1b2a0fb89857ec2ef72908a927058))
* dietary filters, nutrition macros, menu balancing — full stack (stories 431-433,451-453,461-463) ([#42](https://github.com/edcrove/recetario/issues/42)) ([efbc357](https://github.com/edcrove/recetario/commit/efbc357653e625a958fb9a488290dc2729911740))
* **e2e:** critical flows + 100% pass rate + testID + coverage pipeline (story 473) ([b9d854f](https://github.com/edcrove/recetario/commit/b9d854fc470ca536d6b596728e4b148808fa5469))
* **identity:** profile endpoints, households API, MCP identity tools (stories 396-397, 401) ([#32](https://github.com/edcrove/recetario/issues/32)) ([5bd31e9](https://github.com/edcrove/recetario/commit/5bd31e91ba9dd0e9f8ecb30f655816b9a78b7667))
* **import:** recipe import via mcp fetch tool + source provenance ([a88f702](https://github.com/edcrove/recetario/commit/a88f70276ceddc0bc7332022b6a260c28feab41f))
* **import:** recipe import via MCP fetch tool + source provenance ([aa7a297](https://github.com/edcrove/recetario/commit/aa7a297a667a68393d0fc4141f573739f0daba52))
* **mcp:** agentic ingredient curation tools ([2965f61](https://github.com/edcrove/recetario/commit/2965f61a77c656fe93d553f61d2f413c3ebcccbd))
* **mcp:** agentic ingredient curation tools ([fefed62](https://github.com/edcrove/recetario/commit/fefed625a56ec09e06365e318f070822869828c9))
* **mcp:** browseLibrary + copyRecipe tools, visibility on create/update ([cbc55cb](https://github.com/edcrove/recetario/commit/cbc55cbad6e36c24cef36715bb67086ac7617db3))
* **mcp:** browseLibrary + copyRecipe tools, visibility on create/update ([5dd4844](https://github.com/edcrove/recetario/commit/5dd48441e1ab621ed80b00f2557c6df1342084e8))
* **mcp:** scaffold mcp server + api client factory ([78152ad](https://github.com/edcrove/recetario/commit/78152adfbd35121714d2028bdf74786d52f97d5f))
* **mcp:** setNutritionGoals + getDayNutrition (nutrition epic story 5) ([b194ebe](https://github.com/edcrove/recetario/commit/b194ebe78c129769f45a92b616d7a584e97f5add))
* **mcp:** setNutritionGoals + getDayNutrition tools ([c6ad7b7](https://github.com/edcrove/recetario/commit/c6ad7b7a002dd53d2a56c195d16ae3680f9b3791))
* **mcp:** suggest_from_ingredients + get_menu_missing_ingredients ([0b3c954](https://github.com/edcrove/recetario/commit/0b3c95487bdaedaa4b37d9d201bb2d6c4f93015d))
* **mcp:** suggest_from_ingredients + get_menu_missing_ingredients ([fe53452](https://github.com/edcrove/recetario/commit/fe5345281a68685a1c51b085d34e8c7d73756ec3))
* **mcp:** update_pantry + what_can_i_cook ([f586ab4](https://github.com/edcrove/recetario/commit/f586ab427e66c1bdfe8c031baad9732b7bce92c6))
* **mcp:** update_pantry + what_can_i_cook ([3ebc7d1](https://github.com/edcrove/recetario/commit/3ebc7d188f1df75cf4d4d0c47f884ba071041b9b))
* persist foodTypeIds/nutrition/dietaryTags end-to-end + allergen badge in picker ([2005a24](https://github.com/edcrove/recetario/commit/2005a24686c9905a0bf5205e131592c3fb9d6adf))
* weekly menu & shopping list — backend + MCP ([#7](https://github.com/edcrove/recetario/issues/7)) ([2ff5d66](https://github.com/edcrove/recetario/commit/2ff5d6644af90a86708f3811977af9ea6aa30f73))


### Bug Fixes

* **ci:** resolve all PR [#36](https://github.com/edcrove/recetario/issues/36) warnings — unused vars, CodeQL v4, actions node24 ([#37](https://github.com/edcrove/recetario/issues/37)) ([8dc96d2](https://github.com/edcrove/recetario/commit/8dc96d2fa931e234d5c00a71abdd94b4e067b762))
* **mcp:** drop unused api param from registerImportTools ([7a13eb7](https://github.com/edcrove/recetario/commit/7a13eb7a2cbd6281d3cb97da4d1dea9f51b61348))
* **mcp:** tests mocked a 422 API response the real API never sends ([5898294](https://github.com/edcrove/recetario/commit/5898294537b07270ce1d0e380d74b2d5bd8edfaa))
* **mcp:** tests mocked a 422 API response the real API never sends ([cd57a8e](https://github.com/edcrove/recetario/commit/cd57a8e905d8d96ed3e20d69d9cea4ef6390fd5e))
* remediate 11-agent audit findings (IDOR, data loss, missing screens) ([63571d5](https://github.com/edcrove/recetario/commit/63571d50095ea48ffb7d6846ddfdc67fe4e60a06))
* **tooling:** resolve typecheck and test failures from Phase 0 scaffold ([2423ec3](https://github.com/edcrove/recetario/commit/2423ec3d85af40a44826f0c33d9254836ca63d24))
