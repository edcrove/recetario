# Changelog

## [0.2.0](https://github.com/edcrove/recetario/compare/recetario-app-v0.1.0...recetario-app-v0.2.0) (2026-07-02)


### Features

* **api,mcp,app:** taxonomy configurator UI and API (stories 521-527) ([#40](https://github.com/edcrove/recetario/issues/40)) ([851ca43](https://github.com/edcrove/recetario/commit/851ca4319cedd95db7aff18944280a832acc6489))
* **app,ci:** cook history UI and manual test workflow (stories 504-506) ([#36](https://github.com/edcrove/recetario/issues/36)) ([bc55c95](https://github.com/edcrove/recetario/commit/bc55c95444aa0fa6b8c66ce6f418a75306fb3d4e))
* **app,ci:** web build target + metro monorepo config + vitest e2e exclusion ([52561f4](https://github.com/edcrove/recetario/commit/52561f4450041f7e5abbd0d333df433cffde8a8c))
* **app:** cook mode full-screen step navigator ([#14](https://github.com/edcrove/recetario/issues/14)) ([c68390d](https://github.com/edcrove/recetario/commit/c68390d66703d41effcb965ebc224cfaa1e6eebf))
* **app:** cook mode per-step countdown timers ([#15](https://github.com/edcrove/recetario/issues/15)) ([6feb437](https://github.com/edcrove/recetario/commit/6feb43722f671ad1c917ea968cb677e73ee76105))
* **app:** login, register and forgot-password screens with JWT auth (story 398) ([#33](https://github.com/edcrove/recetario/issues/33)) ([037a3ba](https://github.com/edcrove/recetario/commit/037a3ba9b0f38eb351591bb4c9e96e8fbe388e07))
* **app:** playwright e2e harness + smoke test (list/search/cta) ([2bc3def](https://github.com/edcrove/recetario/commit/2bc3def9e79e074102861ae96dca580f91e02c46))
* **app:** taxonomy UI — food types, collections, related, suggestions (514-517) ([#39](https://github.com/edcrove/recetario/issues/39)) ([230430c](https://github.com/edcrove/recetario/commit/230430cd2f5f68a6049b07954c203598840b42d6))
* **app:** translate all UI text to Spanish ([61ebe71](https://github.com/edcrove/recetario/commit/61ebe7176d2a3e4c8057253e532c97cd7447f64d))
* **app:** user menu in Spanish as bottom sheet (story 527) ([#41](https://github.com/edcrove/recetario/issues/41)) ([4729f41](https://github.com/edcrove/recetario/commit/4729f415fca47d8b1eb660e27bf818381c2c1e7e))
* **app:** user profile preferences and household management UI (stories 399-400) ([#34](https://github.com/edcrove/recetario/issues/34)) ([edb6192](https://github.com/edcrove/recetario/commit/edb6192ffbb7ea7359d6638b3f7bcd97992b1ea6))
* **app:** weekly menu planner and shopping list UI ([#10](https://github.com/edcrove/recetario/issues/10)) ([50e64d1](https://github.com/edcrove/recetario/commit/50e64d155ac4eda6991f4f57d9991cd3b637cf17))
* **cook:** ingredient checklist tab in cook mode ([#17](https://github.com/edcrove/recetario/issues/17)) ([dbebbb5](https://github.com/edcrove/recetario/commit/dbebbb573508fa97a584d16da4cc6c94951a6f3d))
* **cook:** keep screen awake during cook mode (story 413) ([#16](https://github.com/edcrove/recetario/issues/16)) ([c5104c2](https://github.com/edcrove/recetario/commit/c5104c2ad9ecc6b281e8ddcc9a592bb1600d5368))
* **cook:** voice read-aloud for step text ([#18](https://github.com/edcrove/recetario/issues/18)) ([82fd9d9](https://github.com/edcrove/recetario/commit/82fd9d928b9475c440f41894be15778ac82e4f64))
* **coverage:** 100% coverage thresholds for MCP and app utils ([259af14](https://github.com/edcrove/recetario/commit/259af14bcfe1b2a0fb89857ec2ef72908a927058))
* dietary filters, nutrition macros, menu balancing — full stack (stories 431-433,451-453,461-463) ([#42](https://github.com/edcrove/recetario/issues/42)) ([efbc357](https://github.com/edcrove/recetario/commit/efbc357653e625a958fb9a488290dc2729911740))
* **e2e:** playwright smoke tests + CI e2e job (spike [#471](https://github.com/edcrove/recetario/issues/471)) ([d0a9571](https://github.com/edcrove/recetario/commit/d0a9571b82faa69469070e1fb3213ecb44cb3f0f))
* **identity:** users, auth, JWT middleware, secrets management ([#31](https://github.com/edcrove/recetario/issues/31)) ([b03415c](https://github.com/edcrove/recetario/commit/b03415c08f5d27ffff85fb29bb33ea8f8aefe72b))
* **infra:** docker compose full stack + CORS for any localhost port ([3f0cda9](https://github.com/edcrove/recetario/commit/3f0cda9abb58185c7eec234032fde864a468aeeb))
* **mcp:** scaffold mcp server + api client factory ([78152ad](https://github.com/edcrove/recetario/commit/78152adfbd35121714d2028bdf74786d52f97d5f))
* multiple recipes per meal slot with per-recipe servings ([#408](https://github.com/edcrove/recetario/issues/408)) ([#45](https://github.com/edcrove/recetario/issues/45)) ([ae2aaf6](https://github.com/edcrove/recetario/commit/ae2aaf67c402eb78f8798cf1dbd2bfb592821b34))


### Bug Fixes

* align 400/422 contract, wire homeScreen utils, suppress CodeQL false positives ([#26](https://github.com/edcrove/recetario/issues/26)) ([5b33719](https://github.com/edcrove/recetario/commit/5b33719f7e3a97317f90d2c75234b1ae64133468))
* **app,shared:** spanish unit labels + filter zero-qty shopping list items ([b74121e](https://github.com/edcrove/recetario/commit/b74121e04fae9b2d99fa1d08cc0ab707257f717a))
* **app:** filter chip styles on web + shopping list shortcut in home ([9bef11d](https://github.com/edcrove/recetario/commit/9bef11d8ef4a94c177140742c11ee7aec2a4f977))
* **app:** fixed header layout — list no longer overlaps controls ([5ffa9c8](https://github.com/edcrove/recetario/commit/5ffa9c81153f2e9dda0d33b0fa88060c5adf3cf8))
* **app:** search focus loss, chip height and layout spacing on home ([0761a4f](https://github.com/edcrove/recetario/commit/0761a4f1ed3b437e0b4cf919c09244f2cfdab8a4))
* **app:** spanish unit labels in shopping list (formatShoppingQty) ([91bd5ab](https://github.com/edcrove/recetario/commit/91bd5ab0d9b8d062a2eaa9d8a114ef91094a6a5d))
* **app:** web auth storage and login error messaging ([ec2d9e4](https://github.com/edcrove/recetario/commit/ec2d9e4a2b4c7fc95dee2b8f08702e1e158729cf))
* **ci:** resolve all PR [#36](https://github.com/edcrove/recetario/issues/36) warnings — unused vars, CodeQL v4, actions node24 ([#37](https://github.com/edcrove/recetario/issues/37)) ([8dc96d2](https://github.com/edcrove/recetario/commit/8dc96d2fa931e234d5c00a71abdd94b4e067b762))
* **test:** use unknown cast for corrupted payload in recipe-form test ([6cf0146](https://github.com/edcrove/recetario/commit/6cf01467bb28c2aba7adb1c7f7f8ab38e347b5a0))
* **tooling:** resolve typecheck and test failures from Phase 0 scaffold ([2423ec3](https://github.com/edcrove/recetario/commit/2423ec3d85af40a44826f0c33d9254836ca63d24))
