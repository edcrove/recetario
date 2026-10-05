# Changelog

## [0.4.0](https://github.com/edcrove/recetario/compare/mcp-v0.3.1...mcp-v0.4.0) (2026-10-05)


### Features

* **collections:** delete a collection; e2e cleanup that checks itself ([#198](https://github.com/edcrove/recetario/issues/198)) ([955c512](https://github.com/edcrove/recetario/commit/955c512f20b6d731cc565975df3a2d6ea9e01ad9))
* **data:** capture servings, source and nutrition per cook session; last login ([#196](https://github.com/edcrove/recetario/issues/196)) ([7c56f20](https://github.com/edcrove/recetario/commit/7c56f20b549bf12dba1f0b28c452d1933c60f708))
* **household:** accept or decline invitations in the app and via mcp ([#163](https://github.com/edcrove/recetario/issues/163)) ([d58ffff](https://github.com/edcrove/recetario/commit/d58ffffba546e17798ebb36c1a1022319027ce70))
* **household:** change a member's role and leave a household ([#219](https://github.com/edcrove/recetario/issues/219)) ([07037e7](https://github.com/edcrove/recetario/commit/07037e74f80c2a5fa949c0f0a73116ba2d57dde0))
* **household:** diners whose allergies and diets warn every member ([#264](https://github.com/edcrove/recetario/issues/264)) ([553ea16](https://github.com/edcrove/recetario/commit/553ea166d2cf0db64dce3f53463f9a99dba88ec3))
* **menu:** planned dishes can be marked cooked or skipped ([#204](https://github.com/edcrove/recetario/issues/204)) ([0750b70](https://github.com/edcrove/recetario/commit/0750b70df69c6f3a2d6240ff1fb24ca8ad7626cf))
* **nutrition:** sugars, saturated fat and sodium when known ([#203](https://github.com/edcrove/recetario/issues/203)) ([70ee0dd](https://github.com/edcrove/recetario/commit/70ee0ddabb64d4f61dbfacd7783dbaf831625697))
* **stats:** cooking streak and a weekly chart of at least 8 weeks ([#222](https://github.com/edcrove/recetario/issues/222)) ([d7ceef0](https://github.com/edcrove/recetario/commit/d7ceef0737bd485f9886dbb550b4f6c7652f6d59))


### Bug Fixes

* a dish planned without servings gets the profile's default portions ([#243](https://github.com/edcrove/recetario/issues/243)) ([9256acf](https://github.com/edcrove/recetario/commit/9256acf03b5ccb3ed5924c29ab6ed87c85bf7194))
* accept only http(s) urls for recipe sources, images and avatars ([#158](https://github.com/edcrove/recetario/issues/158)) ([d84cbc2](https://github.com/edcrove/recetario/commit/d84cbc2f29054127c386c32955f456f91bd76be6))
* allergen enum with curated spanish derivatives and a profile picker ([#171](https://github.com/edcrove/recetario/issues/171)) ([5e98f8e](https://github.com/edcrove/recetario/commit/5e98f8ea9003d0e162da7351097f0a7b5a037714))
* **api:** case-insensitive emails, size limits, accent-insensitive search, proxy-aware rate limit ([#175](https://github.com/edcrove/recetario/issues/175)) ([6ca61c4](https://github.com/edcrove/recetario/commit/6ca61c43fb8c8d360d1831e67e698827a7d4716b))
* **app:** changing a daily nutrition target keeps the per-meal goals ([#253](https://github.com/edcrove/recetario/issues/253)) ([daa720d](https://github.com/edcrove/recetario/commit/daa720d058345bcf5ee1bab3072725e0c88c267e))
* check diet tags against ingredients, tell unknown from unmet ([#173](https://github.com/edcrove/recetario/issues/173)) ([481c158](https://github.com/edcrove/recetario/commit/481c15804caab7f006b32e60d91c0e7fe45ef03a))
* **config:** usage badge lists its recipes and each tab can create items ([#224](https://github.com/edcrove/recetario/issues/224)) ([a689b79](https://github.com/edcrove/recetario/commit/a689b798ebac0dd2cc632a2a9bb59688ffee0c62))
* day and week nutrition report one person's intake ([#172](https://github.com/edcrove/recetario/issues/172)) ([b13cddb](https://github.com/edcrove/recetario/commit/b13cddb61adcfc4240625b1612372e56cd8391c2))
* **mcp:** build recipe tool inputs from shared schemas ([#181](https://github.com/edcrove/recetario/issues/181)) ([3fdacd0](https://github.com/edcrove/recetario/commit/3fdacd01c25f2139de4015204d859012409ebd02))
* **mcp:** delete tools, per-serving macros, whoami and cook history ([#164](https://github.com/edcrove/recetario/issues/164)) ([9748631](https://github.com/edcrove/recetario/commit/97486312f48fb645b0c50a5cdd22acd6936bf397))
* **nutrition:** keep recipe nutrition consistent with edits ([#187](https://github.com/edcrove/recetario/issues/187)) ([5567c3c](https://github.com/edcrove/recetario/commit/5567c3c3faed7e2b14e1a98ea7bfa52e60679a83))
* recipes can use custom categories, matched by slug ([#226](https://github.com/edcrove/recetario/issues/226)) ([2f039be](https://github.com/edcrove/recetario/commit/2f039bedfb1368030b02b67c728b4848da3e1720))
* **security:** ssrf guard resolves dns and re-checks redirects; reset revokes sessions ([#180](https://github.com/edcrove/recetario/issues/180)) ([dbe853e](https://github.com/edcrove/recetario/commit/dbe853e8c92fe6b7c81d646b4d1da6ccb234ae52))

## [0.3.1](https://github.com/edcrove/recetario/compare/mcp-v0.3.0...mcp-v0.3.1) (2026-09-30)


### Bug Fixes

* **build:** exclude tests from production build so the API image builds + CI gate ([3b32889](https://github.com/edcrove/recetario/commit/3b3288986ebe49ca7f7f64ee04fd43561ca2360f))
* **build:** exclude tests from the production tsc build so images build ([e7c7a31](https://github.com/edcrove/recetario/commit/e7c7a3157686e4069b24c79493885a81b493df74))
* **deps:** adapt test suites to vitest 4 ([5bae46a](https://github.com/edcrove/recetario/commit/5bae46a963deef235eaa3bc96782730f4c3be783))

## [0.3.0](https://github.com/edcrove/recetario/compare/mcp-v0.2.0...mcp-v0.3.0) (2026-07-13)


### Features

* auto-detected step timers (durationSeconds + tap-to-start) ([47662b9](https://github.com/edcrove/recetario/commit/47662b917af5090873a52e1d7c138f72f1a18611))
* auto-detected step timers (durationSeconds + tap-to-start) ([1a43aa0](https://github.com/edcrove/recetario/commit/1a43aa069e995d9b1fadc05743dbf16d1c9aaaa3))

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
