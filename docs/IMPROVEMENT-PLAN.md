# Recetario — Plan de mejoras

**Fecha de la revisión:** 2026-09-18
**Base:** `main` en `602726d` (v0.3.0)
**Estado del backlog Notion:** 214 done · 66 backlog · 12 ready · 1 in progress · 1 in review

Este documento es el resultado de una revisión completa del repo (código, CI, PRs
abiertas, backlog de Notion) y un plan de trabajo priorizado. Cada tarea incluye
qué hacer, dónde, cómo se verifica, y **qué modelo de Claude conviene usar** para
ejecutarla en Claude Code. El objetivo es que cualquier tarea se pueda tomar tal
cual como prompt de una sesión.

---

## 1. Diagnóstico

### 1.1 Lo que está bien

- **Calidad técnica alta.** Lint, typecheck y tests verdes localmente: 785 tests
  unit/API/MCP/app en 85 archivos, 90 tests de pantalla, 18 specs E2E. Coverage
  al 100% en `shared` y `mcp`, floors documentados en el resto.
- **Arquitectura clara y documentada.** 12 ADRs, `CLAUDE.md` exhaustivo, pirámide
  de tests exigida por story, pre-push que replica CI, release-please, CodeQL,
  Dependabot con auto-merge.
- **Producto casi completo para v1.** 138 stories done. Recetas, menú semanal,
  cook mode, despensa, heladera, nutrición, hogares, colecciones, importación,
  lista de compras, MCP con ~40 tools.

### 1.2 Lo que está mal o trabado

| #   | Problema                                                                                                                                                                                     | Impacto                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| D1  | **No hay deploy.** ADR-012 decidió Railway + PWA el 27 jul; las 4 stories P1 de infra siguen en Backlog. Cero usuarios reales.                                                               | Todo el valor del producto está bloqueado            |
| D2  | **Proyecto pausado 7 semanas.** Último commit humano: 27 jul. Desde entonces solo Dependabot (96 commits en julio, 8 en agosto, 3 en septiembre).                                            | Se pierde contexto; deps se desvían                  |
| D3  | **PR #125** (fix P1: IDOR en `POST /v1/collections/:id/recipes` + visibilidad de hogar en `GET`) abierta desde el 27 jul esperando decisión de producto.                                     | Fix de seguridad sin mergear                         |
| D4  | **PR #124** (release-please) abierta desde julio.                                                                                                                                            | No se corta release                                  |
| D5  | **Workflow Security rojo en main** cada lunes: `pnpm audit --audit-level=high` reporta 43 vulns (28 high, 15 moderate), todas transitivas de devDeps.                                        | Señal de seguridad inutilizada por ruido             |
| D6  | **PR #143 (Dependabot) rompe el build**: bumpea `react-native` 0.86→0.87 fuera de Expo SDK 56 (`ERR_PACKAGE_PATH_NOT_EXPORTED ./rn-get-polyfills`). Viola CLAUDE.md.                         | Auto-merge bloqueado, ruido semanal                  |
| D7  | **PR #140 (Dependabot security)**: vitest 3.2→4.1 major, CI rojo.                                                                                                                            | Idem                                                 |
| D8  | **El lint de la app no cubre `src/`**: el script es `eslint app`. Corriendo `eslint src` aparecen 12 warnings que `--max-warnings=0` debería frenar.                                         | CI da falsa seguridad                                |
| D9  | **README desactualizado**: dice Hono 4.7, Drizzle 0.41, Expo SDK 53 / Router v4. Real: Hono 4.13, Drizzle 0.45, Expo 56 / Router 56.                                                         | Primera impresión mala para el pilar showcase        |
| D10 | Sin `app.onError` global ni logging estructurado en el API (4 `console.log`). Un throw no manejado devuelve el 500 default de Hono sin traza ni request id.                                  | Imposible diagnosticar en producción                 |
| D11 | El fallback `DEV_API_KEY` en `middleware/auth.ts` se activa en el `catch` de **cualquier** error de DB, no solo si la DB está caída. Enmascara errores reales como 401.                      | Debug confuso; riesgo si la env var se filtra a prod |
| D12 | CORS acepta cualquier origen de LAN privada (RFC 1918) incondicionalmente, también en producción.                                                                                            | Superficie innecesaria en prod                       |
| D13 | Rate limiter en memoria (`Map` por ownerId) que nunca poda entradas.                                                                                                                         | Leak lento; se resetea en cada deploy                |
| D14 | `apps/app` tiene `jest`, `jest-expo`, `babel-jest`, `@types/jest`, `@react-native/jest-preset`, `@testing-library/react-native`, `react-hooks`, `c8` como devDeps. CLAUDE.md dice "No Jest". | Superficie de audit y de instalación sin uso         |
| D15 | El job de coverage de integración corre con `continue-on-error: true`.                                                                                                                       | Puede fallar en silencio                             |
| D16 | Dockerfile de la app roto (`expo export` en el builder). Conocido, backlog P2.                                                                                                               | CI no gatea la imagen web                            |

---

## 2. Cómo usar este plan

### 2.1 Qué modelo para qué tarea

La regla general: **el modelo más barato que pueda terminar la tarea sin
supervisión, con CI como oráculo.** Subir de modelo cuando la tarea requiere
juicio (decisiones de diseño, seguridad, muchos archivos que interactúan, o
diagnóstico de fallas sin mensaje de error claro).

| Modelo               | ID                 | Precio (in/out por MTok) | Usar para                                                                                                                                                                                         |
| -------------------- | ------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude Haiku 4.5** | `claude-haiku-4-5` | $1 / $5                  | Tareas mecánicas con spec cerrada y verificación automática: limpiar warnings, actualizar docs con datos dados, sacar deps, editar YAML de CI, renombrar.                                         |
| **Claude Sonnet 5**  | `claude-sonnet-5`  | $2 / $10                 | Features y fixes con patrón existente en el repo: nuevo endpoint copiando otro, middleware estándar, tests que siguen un template, pantallas nuevas con componentes ya hechos.                    |
| **Claude Opus 5**    | `claude-opus-5`    | $5 / $25                 | Trabajo multi-archivo con decisiones: cambios de schema + migración + API + MCP + app, infra/deploy, seguridad, migraciones de deps mayores, diagnóstico de CI sin error obvio.                   |
| **Claude Fable 5.1** | `claude-fable-5-1` | $10 / $50                | Lo más difícil o lo que define el producto: upgrade de Expo SDK con fallas encadenadas, diseño de tools MCP agénticas, spikes de producto, auditorías completas, revisión final antes de release. |

Notas prácticas:

- En Claude Code el esfuerzo se controla con `/effort` (o `--effort`). Para Sonnet 5 y
  Opus 5 usar `high` por defecto y `xhigh` en tareas agénticas largas. Para Haiku no
  aplica.
- Una tarea marcada Haiku que falla dos veces en CI se escala a Sonnet, no se
  reintenta una tercera vez.
- **Revisión de PR**: independientemente del modelo que implementó, la revisión
  (`/code-review` o `/security-review`) conviene hacerla con Opus 5 como mínimo, y
  con Fable 5.1 en las tareas marcadas de seguridad.

### 2.2 Modos de trabajo (alineado al backlog Notion)

- **Modo 1 — Chat**: decisiones. No toca el repo.
- **Modo 2 — Remoto (delegable)**: sesión de Claude Code en la web con la tarea como
  prompt. Termina en PR. Es el modo por defecto de este plan.
- **Modo 3 — En la máquina**: requiere Docker, cuentas externas (Railway, Netlify),
  secrets, o probar en un teléfono.

### 2.3 Convenciones que aplican a toda tarea

- Una tarea = una branch (`fix/…`, `feat/…`, `chore/…`) = una PR = un commit
  convencional con la URL de Notion en el body.
- Pirámide de tests completa según `CLAUDE.md`. Si una capa no aplica, se justifica
  en la PR.
- Nunca bajar un threshold de coverage.
- Actualizar el estado en Notion (In progress → In review → Done).
- Cada tarea lista **Aceptación** (qué tiene que ser verdad para mergear) y
  **Verificación** (el comando o el hecho observable que lo prueba).

---

## 3. Fase 0 — Destrabar (1 a 2 días)

Objetivo: dejar `main` verde en todos los workflows, mergear lo pendiente, y que
Dependabot vuelva a auto-mergear sin romper nada. Todo esto es prerequisito
de la Fase 1: no tiene sentido deployar sobre un repo con CI rojo.

### F0.1 — Decidir y mergear PR #125 (IDOR en collections)

- **Qué**: la PR implementa que las colecciones respetan visibilidad de hogar
  (un housemate ve las recetas de otro miembro dentro de una colección) y bloquea
  agregar `recipeId` ajenos (404). Falta una decisión de producto: ¿las
  colecciones son compartidas por hogar o estrictamente del dueño?
- **Recomendación**: mergear tal cual. Es consistente con el epic de sharing y con
  cómo funcionan recetas y menú. Si se quisiera lo contrario, el fix de IDOR
  (el `POST`) igual debe entrar.
- **Dónde**: `packages/api/src/routes/taxonomy.ts`, tests unit e integración ya
  incluidos en la PR.
- **Aceptación**: PR mergeada, story "Order 1" en Done.
- **Verificación**: CI verde en la PR después de rebase sobre `main` actual.
- **Modelo**: Modo 1 para la decisión (vos). Rebase + merge: Haiku 4.5.
- **Puntos**: 0.5

### F0.2 — Arreglar Dependabot para que no rompa Expo

- **Qué**: en `.github/dependabot.yml` agregar `ignore` para `react-native`,
  `react-native-web`, `expo`, `expo-*`, `@expo/*`, `babel-preset-expo`,
  `jest-expo` en todos los update-types. Estas deps solo se actualizan con
  `npx expo install` en un chore de upgrade de SDK (ver F4.2). Cerrar PR #143 con
  un comentario que referencie este cambio. Dejar que Dependabot reabra el resto
  del grupo sin RN.
- **Dónde**: `.github/dependabot.yml`.
- **Aceptación**: la próxima corrida semanal de Dependabot no incluye ningún
  paquete de Expo/RN.
- **Verificación**: `pnpm --filter recetario-app build` sigue verde en `main`.
- **Modelo**: Haiku 4.5.
- **Puntos**: 0.5

### F0.3 — Resolver vitest 4 (PR #140)

- **Qué**: PR #140 es un _security update_ de Dependabot (por eso saltó el `ignore`
  de majors). Dos opciones: (a) migrar a vitest 4 en un chore propio; (b) cerrar
  #140 y pinear `vitest@3` con override hasta la Fase 4. **Recomendación: (a)**,
  porque vitest 4 + `@vitest/coverage-v8` 4 resuelven varias de las vulns
  transitivas de D5 (esbuild, `@vitest/mocker`) y la migración es acotada.
- **Dónde**: `package.json` de los 4 paquetes, `vitest*.config.ts`, mocks en
  `apps/app/src/__mocks__/`. Revisar breaking changes de vitest 4 (workspace →
  projects, `coverage.all` removido, cambios en `vi.mock` hoisting).
- **Aceptación**: `pnpm ci:local` verde; coverage no baja en ningún paquete.
- **Verificación**: `pnpm test && pnpm --filter recetario-app test:screens`, y los
  jobs `coverage` y `e2e` en CI.
- **Modelo**: Opus 5 (migración de tooling con fallas potencialmente encadenadas
  en 4 paquetes y dos entornos de test).
- **Puntos**: 2
- **Depende de**: nada. Puede ir en paralelo con F0.2.

### F0.4 — Hacer que el workflow Security signifique algo

- **Qué**: hoy `pnpm audit --audit-level=high` falla por 28 highs, todas en devDeps
  transitivas (`postcss`, `js-yaml`, `undici`, `browserslist`, `brace-expansion`,
  `image-size`, `fast-uri`, `@xmldom/xmldom`). Plan:
  1. Correr `pnpm audit --prod --audit-level=high` como gate bloqueante (lo que
     realmente se deploya).
  2. Mantener el audit completo como job informativo (`continue-on-error: true`
     con summary en el step), no como gate.
  3. Agregar `pnpm.overrides` en el root `package.json` para las transitivas que
     tienen fix y no rompen nada (`js-yaml`, `brace-expansion`, `fast-uri`,
     `undici`). Ya hay un precedente con `@xmldom/xmldom`.
  4. Documentar en `docs/SECURITY.md` (nuevo) el criterio: prod bloquea, dev
     informa, y cómo se justifica un ignore.
- **Dónde**: `.github/workflows/security.yml`, `package.json` (overrides),
  `docs/SECURITY.md`.
- **Aceptación**: workflow Security verde en `main` con al menos una vuln real
  bloqueante si se introdujera en prod deps.
- **Verificación**: `pnpm audit --prod --audit-level=high` exit 0; `pnpm ci:local`
  verde después de los overrides.
- **Modelo**: Opus 5 (elegir qué overrides son seguros requiere leer changelogs y
  correr la suite completa; es fácil romper Metro o Playwright con un override
  mal puesto).
- **Puntos**: 2
- **Depende de**: F0.3 (vitest 4 saca varias del listado).

### F0.5 — Lint de la app cubriendo `src/`

- **Qué**: cambiar `"lint": "eslint app"` por `"lint": "eslint app src"` en
  `apps/app/package.json`. Limpiar los 12 warnings actuales (imports sin usar:
  `View` en `FoodTypePicker.tsx`, `count` en un test, etc.).
- **Dónde**: `apps/app/package.json`, ~8 archivos en `apps/app/src/`.
- **Aceptación**: `pnpm turbo run lint -- --max-warnings=0` verde.
- **Verificación**: el job Lint de CI.
- **Modelo**: Haiku 4.5.
- **Puntos**: 0.5

### F0.6 — README actualizado

- **Qué**: corregir la tabla de stack (Hono 4.13, Drizzle 0.45, Expo SDK 56,
  Expo Router 56, RN 0.86, React 19, Vitest 3 o 4 según F0.3), agregar la sección
  "Cómo correr E2E local" y un link a este plan y a `docs/adr/`. No hacer todavía el
  README "aterriza en dos minutos" del backlog (Order 110); eso es Fase 4.
- **Dónde**: `README.md`.
- **Aceptación**: cada versión del README coincide con `pnpm-lock.yaml`.
- **Verificación**: revisión manual de un minuto.
- **Modelo**: Haiku 4.5.
- **Puntos**: 0.5

### F0.7 — Cortar release v0.4.0

- **Qué**: con F0.1 a F0.6 mergeadas, dejar que release-please actualice PR #124 y
  mergearla. Verificar que los `CHANGELOG.md` de los 4 paquetes tengan sentido.
- **Aceptación**: tag `v0.4.0` en GitHub, PR #124 cerrada por merge.
- **Modelo**: vos (Modo 1/3). No requiere modelo.
- **Puntos**: 0.25

---

## 4. Fase 1 — Deploy (la fase de más valor)

Objetivo: que la familia pueda abrir la app desde el teléfono y que los datos
tengan backup probado. Corresponde a las stories Order 0.2 a 0.5, 10 y 11 del
backlog. Es la única fase donde varias tareas son Modo 3 porque requieren
cuentas y secrets.

### F1.1 — Provisionar API + Postgres en Railway

- **Qué**: crear el proyecto en Railway con un servicio Postgres y un servicio API
  desde el repo (Nixpacks, root `packages/api`). Variables: `DATABASE_URL`,
  `JWT_SECRET` (64 hex), `NODE_ENV=production`, `PORT`, `CORS_ORIGIN` (dominio de
  la PWA). Sin `DEV_API_KEY`. El `entrypoint.sh` ya corre `drizzle-kit migrate`
  antes de arrancar; verificar que Nixpacks lo use o replicar en `railway.toml`
  con `startCommand`.
- **Dónde**: `railway.toml` (nuevo, en root o `packages/api`), posiblemente
  `packages/api/package.json` (`start` que migre primero).
- **Aceptación**: `GET https://<api>/health` responde 200; `/docs` sirve Swagger;
  un login con cuenta demo devuelve JWT.
- **Verificación**: `curl` a health y a `/v1/recipes` con el JWT.
- **Modelo**: Opus 5 para preparar `railway.toml`, checklist de variables y el
  runbook de "primer deploy" en `docs/ops/DEPLOY.md`. La creación del proyecto y
  los secrets los hacés vos (Modo 3).
- **Puntos**: 3

### F1.2 — Seed inicial en producción

- **Qué**: correr `pnpm --filter @recetario/api seed` (taxonomía) contra la DB de
  producción una vez, crear las cuentas reales de la familia y el hogar, y
  generar la API key del agente MCP con `generate-key.ts`. Documentar el
  procedimiento y **no** correr `seed-demo-data.ts` ni `seed-e2e-accounts.ts` en
  prod (agregar un guard `NODE_ENV === 'production'` que aborte en esos dos
  scripts).
- **Dónde**: `packages/api/src/scripts/seed-demo-data.ts`,
  `seed-e2e-accounts.ts`, `docs/ops/DEPLOY.md`.
- **Aceptación**: los scripts de demo abortan con mensaje claro en prod; la
  taxonomía está cargada; existe al menos un usuario real y una API key.
- **Verificación**: test unit para el guard; `GET /v1/meal-categories` en prod
  devuelve las categorías por defecto.
- **Modelo**: Sonnet 5 para los guards + tests; Modo 3 para ejecutar.
- **Puntos**: 1
- **Depende de**: F1.1

### F1.3 — PWA en hosting estático

- **Qué**: `expo export --platform web` con `EXPO_PUBLIC_API_URL` apuntando a
  Railway, publicado en Netlify o Cloudflare Pages desde GitHub Actions en cada
  push a `main` (job `deploy-web` en un workflow nuevo `deploy.yml`, gateado por
  `ci` verde). Agregar `app.json` → `web.manifest` completo (nombre, íconos
  192/512, `display: standalone`, `theme_color`) para que "Agregar a pantalla de
  inicio" funcione en iOS y Android. Revisar `apps/app/nginx.conf` o el `_redirects`
  para SPA fallback.
- **Dónde**: `.github/workflows/deploy.yml`, `apps/app/app.json`,
  `apps/app/public/` (íconos, `_redirects`/`_headers`).
- **Aceptación**: la URL pública carga, login funciona, la app se instala como PWA
  en un iPhone y un Android de la familia.
- **Verificación**: Lighthouse PWA installable; smoke E2E (`e2e/smoke.spec.ts`)
  corriendo contra la URL pública con `PLAYWRIGHT_BASE_URL`.
- **Modelo**: Sonnet 5 para workflow + manifest; Opus 5 si el hosting requiere
  headers de cache/CSP no triviales. Modo 3 para conectar la cuenta del host.
- **Puntos**: 3
- **Depende de**: F1.1

### F1.4 — Backups con restore probado

- **Qué**: Railway hace backups automáticos, pero la story exige un restore
  probado. Implementar un script `scripts/db-backup.sh` (`pg_dump` custom format
  a un bucket o a Railway volumes) y `scripts/db-restore.sh`, más un workflow
  semanal `backup-verify.yml` que: descarga el último dump, lo restaura en un
  Postgres efímero del runner, corre `drizzle-kit migrate` (debe ser no-op) y
  hace un `SELECT count(*)` de `recipes` y `users`. Falla si cualquiera da 0.
- **Dónde**: `scripts/db-backup.sh`, `scripts/db-restore.sh`,
  `.github/workflows/backup-verify.yml`, `docs/ops/BACKUP.md`.
- **Aceptación**: el workflow corre verde una vez por semana; el runbook dice
  exactamente qué comando correr para restaurar a producción.
- **Verificación**: ejecución manual del workflow con `workflow_dispatch`.
- **Modelo**: Opus 5.
- **Puntos**: 2
- **Depende de**: F1.1

### F1.5 — Canal de feedback de la familia

- **Qué**: la forma más barata que funcione: un botón "Reportar problema" en
  `app/profile/index.tsx` que abre un `mailto:` o un formulario (GitHub Issues vía
  template `bug_report.yml` ya existe, pero la familia no tiene GitHub). Opción
  recomendada: `POST /v1/feedback` que guarda `{ userId, message, screen,
appVersion, userAgent }` en una tabla `feedback` y un tool MCP `list_feedback`
  para que el agente los lea. Esto mantiene el principio agent-first.
- **Dónde**: schema + migración, `packages/api/src/routes/feedback.ts`,
  `packages/mcp/src/tools/feedback.ts`, `apps/app/app/profile/index.tsx`,
  `packages/shared/src/schema.ts`.
- **Aceptación**: un usuario manda feedback desde el teléfono y el agente lo lee
  por MCP.
- **Verificación**: pirámide completa (unit route 200/400/401, integración,
  screen test del botón, E2E smoke).
- **Modelo**: Sonnet 5 (patrón idéntico a `cook-sessions`).
- **Puntos**: 2
- **Depende de**: F1.3

### F1.6 — Secrets de deploy en GitHub Actions y rotación de API keys

- **Qué**: documentar y scriptear: (a) qué secrets viven en GitHub Actions
  (`RAILWAY_TOKEN`, `NETLIFY_AUTH_TOKEN`, etc.), quién los rota y cada cuánto;
  (b) `scripts/rotate-api-key.ts` que genera una key nueva, la inserta en
  `api_keys`, imprime la key en claro una sola vez y marca la anterior con
  `revokedAt` (agregar la columna si no existe).
- **Dónde**: `docs/ops/SECRETS.md`, `packages/api/src/scripts/rotate-api-key.ts`,
  schema `api_keys`.
- **Aceptación**: el middleware rechaza keys revocadas (test unit); el doc lista
  cada secret con su owner.
- **Modelo**: Sonnet 5.
- **Puntos**: 2
- **Depende de**: F1.1

---

## 5. Fase 2 — Hardening del API

Objetivo: que cuando algo falle en producción se pueda saber qué pasó, y cerrar
las superficies innecesarias detectadas en el diagnóstico (D10 a D15).

### F2.1 — Error handler global + request id + logger estructurado

- **Qué**: en `packages/api/src/index.ts` agregar `app.use(requestId())` (Hono
  trae `hono/request-id`), `app.onError` que loguea `{ requestId, method, path,
ownerId, err }` y responde `{ error: 'Internal error', requestId }` con 500 sin
  filtrar el stack, y `app.notFound` JSON. Reemplazar los `console.log` por
  `pino` con nivel por `LOG_LEVEL`, JSON en prod y pretty en dev. Loguear cada
  request con status y duración (`hono/logger` custom o middleware propio).
- **Dónde**: `packages/api/src/index.ts`, `packages/api/src/logger.ts` (nuevo),
  middleware existente.
- **Aceptación**: un throw en un handler devuelve 500 JSON con `requestId` y el
  log tiene el stack; 404 devuelve JSON.
- **Verificación**: tests unit para `onError` y `notFound` (200/404/500), coverage
  se mantiene en 100/100/98.
- **Modelo**: Sonnet 5.
- **Puntos**: 2

### F2.2 — Cerrar el fallback `DEV_API_KEY` y CORS de LAN en producción

- **Qué**: en `middleware/auth.ts`, separar "DB no disponible" de "otro error":
  el fallback a `DEV_API_KEY` solo aplica si `NODE_ENV !== 'production'`; en
  producción cualquier error de DB devuelve 503 con log, nunca 401. En `index.ts`,
  el matcher de RFC 1918 en CORS solo aplica fuera de producción; en prod solo
  `CORS_ORIGIN`. Agregar test que arranca con `NODE_ENV=production` y verifica
  ambos comportamientos.
- **Dónde**: `packages/api/src/middleware/auth.ts`, `packages/api/src/index.ts`,
  tests correspondientes.
- **Aceptación**: en prod, sin `CORS_ORIGIN` correcto el navegador no puede llamar
  al API; con la DB caída el API responde 503, no 401.
- **Modelo**: Sonnet 5. Revisión con `/security-review` en Opus 5.
- **Puntos**: 1

### F2.3 — Rate limiter que no filtre memoria

- **Qué**: podar entradas vencidas cada N requests o con un `setInterval`
  `unref()`; extraer `WINDOW_MS`/`MAX_REQUESTS` a env; devolver headers
  `RateLimit-Limit`, `RateLimit-Remaining`, `Retry-After`. Documentar que es
  por proceso y suficiente para escala hogar (ADR-012); si algún día hay más de
  una réplica, mover a Postgres o Redis.
- **Dónde**: `packages/api/src/middleware/rateLimit.ts` + test.
- **Modelo**: Haiku 4.5.
- **Puntos**: 0.5

### F2.4 — Coverage de integración como gate real

- **Qué**: sacar `continue-on-error: true` del step "Generate API integration
  coverage" en `ci.yml`. Si falla por Testcontainers en el runner, arreglar la
  causa (probablemente usar el servicio `postgres` del job en vez de
  Testcontainers cuando `DATABASE_URL` está seteada).
- **Dónde**: `.github/workflows/ci.yml`, `packages/api/vitest.integration.config.ts`.
- **Aceptación**: el job `coverage` falla si la integración falla.
- **Modelo**: Sonnet 5; escalar a Opus 5 si el fallo es de infra de Docker en
  el runner.
- **Puntos**: 1

### F2.5 — Matriz IDOR y contract test MCP↔API

- **Qué**: dos items del backlog (Order 117 y 118) que se vuelven urgentes al
  tener usuarios reales:
  - **IDOR**: test de integración parametrizado que, para cada recurso con
    `ownerId` (recipes, menu entries, cook sessions, collections, relations,
    pantry, shopping checks), crea el recurso con el usuario A, y verifica que B
    (fuera del hogar) obtiene 404 en GET/PUT/DELETE y que C (mismo hogar) obtiene
    lo que la política de visibilidad indica. Cubre también `getMenuNutrition`
    sin guard `UUID_RE` (bug Order 19) y ownership en relations (Order 20).
  - **Contract**: test en `packages/mcp` que levanta el API real (integración con
    Testcontainers) y ejecuta cada tool MCP contra él validando el shape de
    respuesta con los Zod schemas de `shared`. Hoy MCP se testea con cliente
    mockeado.
- **Dónde**: `packages/api/src/__tests__/idor-matrix.integration.test.ts`,
  `packages/mcp/src/__tests__/contract.integration.test.ts`, config de vitest
  para integración en `mcp`.
- **Aceptación**: cada bug que encuentre la matriz se arregla en la misma PR o en
  una PR `fix/` inmediata, nunca se marca skip.
- **Modelo**: Opus 5 (es la tarea de seguridad más valiosa del plan; hay que
  entender `household-visibility.ts` y cada repositorio).
- **Puntos**: 5 (2 + 3)

### F2.6 — Runbook de operaciones

- **Qué**: `docs/ops/RUNBOOK.md` con: cómo ver logs en Railway, qué significa cada
  error del logger de F2.1, cómo rotar `JWT_SECRET` (invalida sesiones), cómo
  restaurar backup (F1.4), cómo rotar API key (F1.6), cómo hacer rollback de un
  deploy. Corresponde a Order 12 del backlog.
- **Modelo**: Sonnet 5 con los docs anteriores como input.
- **Puntos**: 1
- **Depende de**: F1.4, F1.6, F2.1

---

## 6. Fase 3 — Producto

Objetivo: las features P1 del backlog en el orden que ya tiene definido. Todas
son Modo 2.

### F3.1 — Bug: categorías de comida custom no se pueden asignar (Order 2)

- **Qué**: el configurador permite crear `meal_categories` custom pero el form de
  receta y el tool MCP `create_recipe` solo aceptan las seed. Alinear el Zod schema
  de `shared`, la validación en `routes/recipes.ts` y el picker en
  `app/recipe/new.tsx` y `edit.tsx` para que acepten cualquier categoría del
  owner.
- **Modelo**: Sonnet 5.
- **Puntos**: 2

### F3.2 — Fotos: storage + `recipes.imageUrl` (Order 3) y UI (Order 4)

- **Qué**: backend: columna `image_url`, `POST /v1/recipes/:id/image` con upload
  multipart a un bucket (Cloudflare R2 o Railway volume; decidir en la PR con una
  mini-ADR), límite de tamaño, tipo MIME validado, URL firmada o pública. MCP:
  `set_recipe_image(recipeId, url)` para que el agente pueda pegar una URL
  externa. App: `expo-image-picker` en el form, thumbnail en cards, hero en el
  detalle.
- **Dónde**: schema + migración, `routes/recipes.ts`, `mcp/tools/mutateRecipes.ts`,
  `app/recipe/new.tsx`, `edit.tsx`, `[id].tsx`, `src/components/RecipeCard.tsx`.
- **Aceptación**: subir foto desde el teléfono y verla en la lista y el detalle.
- **Modelo**: Opus 5 para el backend (decisión de storage + seguridad de upload);
  Sonnet 5 para la UI en una segunda PR.
- **Puntos**: 6 (3 + 3)

### F3.3 — Sobras: cook sessions + inventario (Order 6) y planner (Order 7)

- **Qué**: al terminar de cocinar, registrar porciones sobrantes; entran a
  `pantry_items` con `source: 'leftover'` y fecha; se pueden agendar en el menú
  como entrada de tipo `leftover`. Afecta schema, `cook-sessions.ts`, `pantry.ts`,
  `menu.ts`, `menuGap.ts` en shared, tools MCP de pantry y menú, y tres pantallas.
- **Modelo**: Opus 5 (toca 4 dominios y el ranking de "qué puedo cocinar").
- **Puntos**: 5

### F3.4 — Tools MCP agénticas: `adapt_recipe` (Order 8) y `plan_week` (Order 9)

- **Qué**: `adapt_recipe(recipeId, constraint)` crea un fork de la receta con una
  relación `adapted_from` y devuelve al agente el contexto necesario (receta
  original, restricciones del hogar, alérgenos) para que **el agente** genere la
  adaptación y la guarde con `update_recipe`; la tool no hace inferencia (el
  principio agent-first se mantiene: el API no llama a ningún LLM). `plan_week`
  devuelve el estado de la semana, gaps (`menuGap`), inventario, historial de
  cocina y objetivos nutricionales en una sola llamada, para que el agente
  proponga y luego escriba con `set_menu_entry`. Ambas necesitan diseño de
  contrato: qué devuelve, qué tamaño, cómo se pagina.
- **Dónde**: `packages/mcp/src/tools/`, posiblemente endpoints agregadores nuevos
  en el API (`GET /v1/menu/week-context`).
- **Aceptación**: un agente con Claude Opus 5 conectado al MCP puede, en una
  conversación, planificar una semana completa y adaptar una receta a "sin
  gluten" sin que el usuario toque la app.
- **Verificación**: además de la pirámide, un eval manual documentado en
  `docs/evals/mcp-planning.md` con 5 conversaciones de referencia.
- **Modelo**: **Fable 5.1**. Es diseño de interfaz para agentes: lo que devuelve
  la tool determina la calidad de lo que el agente puede hacer, y no hay patrón
  previo en el repo. Implementación posterior con Sonnet 5 si el contrato queda
  bien especificado en la PR de diseño.
- **Puntos**: 6 (3 + 3)

### F3.5 — Cerrar el spike de UX (Order 201, "In progress")

- **Qué**: está abierto desde julio. Cerrarlo con un documento
  `docs/product/UX-AUDIT-2026-09.md` que liste ambigüedades, propuestas y un
  refresh visual acotado, y convierta cada propuesta en story del backlog con
  puntos. También resolver los dos "Decide:" en Ready (Order 203 BYOK importer,
  Order 204 qué significa "done").
- **Modelo**: Fable 5.1 para el spike (juicio de producto, comparación
  competitiva); Modo 1 para las dos decisiones.
- **Puntos**: 3

---

## 7. Fase 4 — Higiene y showcase

Objetivo: reducir superficie, subir el techo de calidad, y que el repo se
explique solo. Ninguna tarea bloquea a otra fase.

### F4.1 — Sacar Jest y deps muertas de `apps/app`

- **Qué**: remover `jest`, `jest-expo`, `babel-jest`, `@types/jest`,
  `@react-native/jest-preset`, `@testing-library/react-native`,
  `@testing-library/react-hooks`, `c8`. Verificar que ningún archivo los importe
  (`grep -r "from '@testing-library/react-native'"`). Reemplazar
  `renderHook` de `react-hooks` por el de `@testing-library/react` si aparece.
- **Aceptación**: `pnpm install` sin esos paquetes; `pnpm ci:local` verde;
  `pnpm audit` con menos entradas.
- **Modelo**: Haiku 4.5; escalar a Sonnet 5 si algún test dependía de un mock de
  jest.
- **Puntos**: 1

### F4.2 — Upgrade Expo SDK 56 → 57 (Order 25)

- **Qué**: `npx expo install expo@^57 --fix`, seguir la guía oficial de upgrade,
  regenerar `babel-preset-expo`, revisar `metro.config.js` y
  `e2e/build-instrumented.js` (istanbul), volver a correr todo incluyendo E2E con
  coverage. Habilita el bump de RN que Dependabot intentó en #143.
- **Aceptación**: `pnpm ci:full` y el job `e2e` verdes; ratchet de E2E no baja.
- **Modelo**: **Fable 5.1**. Los upgrades de SDK de Expo típicamente rompen 3 o 4
  cosas encadenadas (Metro, babel, react-native-web, Playwright coverage) sin
  mensajes claros. Es el caso de uso donde más se nota la diferencia de modelo.
- **Puntos**: 3
- **Depende de**: F4.1, F0.3

### F4.3 — Arreglar el Dockerfile de la app y gatearlo en CI (Order 0.16)

- **Qué**: el `expo export` falla en el builder porque el install parcial del
  workspace no resuelve `@expo/cli`. Opciones: `pnpm deploy --filter recetario-app`
  para un árbol autocontenido, o copiar el lockfile completo y hacer
  `pnpm install --frozen-lockfile --filter recetario-app...`. Agregar el build al
  job `docker-build` de `ci.yml` cuando esté verde.
- **Modelo**: Opus 5.
- **Puntos**: 2

### F4.4 — Helpers E2E por pantalla (Order 114) y ratchet a 97 (Order 115)

- **Qué**: extraer `e2e/helpers/{menu,household,recipeDetail}.ts` de los specs que
  duplican navegación, y subir los floors de `.nycrc.json` a lo que dé la
  ejecución actual.
- **Modelo**: Sonnet 5.
- **Puntos**: 4 (2 + 2)

### F4.5 — Showcase: diagrama de arquitectura, README "dos minutos", AI-COLLABORATION.md

- **Qué**: Orders 105, 110, 108 del backlog. Mermaid con el flujo Agent → MCP →
  API → Postgres y App → API; README que en dos minutos muestre qué es, cómo se ve
  (screenshots de la PWA de F1.3) y cómo correrlo; y un doc que explique cómo se
  construyó el proyecto con un agente (este plan es un buen insumo).
- **Modelo**: Sonnet 5 para el diagrama y el README; Opus 5 para
  `AI-COLLABORATION.md` (requiere leer la historia de commits y los ADRs y
  sintetizar).
- **Puntos**: 7

### F4.6 — OpenTelemetry (backlog sin prioridad)

- **Qué**: cuando F2.1 esté hecho, agregar `@opentelemetry/sdk-node` con exporter
  OTLP a un backend gratuito (Grafana Cloud free tier o Honeycomb free) para
  trazas de request y queries de Drizzle. Solo si el logging de F2.1 resulta
  insuficiente en la práctica; no antes.
- **Modelo**: Sonnet 5.
- **Puntos**: 2

---

## 8. Secuencia sugerida

```
Semana 1   F0.1 F0.2 F0.5 F0.6  →  F0.3  →  F0.4  →  F0.7 (release v0.4.0)
Semana 2   F1.1 → F1.2 → F1.3          F2.1 F2.2 F2.3 (en paralelo, Modo 2)
Semana 3   F1.4 F1.5 F1.6              F2.4 F2.5
Semana 4   F2.6                        F3.1 F3.5
Semana 5+  F3.2 → F3.3 → F3.4          F4.x cuando haya hueco
```

Reglas de la secuencia:

- Nada de Fase 1 se deploya con Security o CI rojos en `main`.
- Fase 2 y Fase 1 pueden ir en paralelo porque tocan archivos distintos.
- F3.4 (tools agénticas) va después de F3.3 porque `plan_week` necesita las
  sobras en el inventario para ser útil.
- F4.2 (Expo 57) mejor en un momento sin otras PRs abiertas en `apps/app`.

Resumen de puntos por fase: F0 ≈ 6 · F1 ≈ 13 · F2 ≈ 10.5 · F3 ≈ 22 · F4 ≈ 19.

---

## 9. Riesgos

| Riesgo                                                           | Mitigación                                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Railway cambia pricing o límites del plan hobby                  | ADR-012 ya tiene fallback (Neon + Fly). `railway.toml` y el runbook deben ser portables.          |
| Un override de `pnpm audit` rompe Metro o Playwright en silencio | F0.4 corre `pnpm ci:full` + E2E antes de mergear cada override.                                   |
| El upgrade a Expo 57 se traba por semanas                        | Hacerlo en branch aislada, sin bloquear nada. Si no converge en 2 sesiones, revertir y pinear.    |
| La matriz IDOR encuentra bugs que requieren cambios de schema    | Se tratan como P0 y pasan antes de F3.                                                            |
| Datos reales en prod antes de tener backup probado               | F1.4 va inmediatamente después de F1.3; hasta entonces, la familia no carga datos irrecuperables. |
| Uso de modelos caros para tareas que no lo requieren             | La tabla de 2.1 es la referencia; escalar solo tras dos fallos.                                   |

---

## 10. Mantenimiento de este documento

- Al cerrar una tarea, marcar `✅ <fecha> <PR>` al final de su título.
- Si una tarea cambia de alcance, editarla acá **y** en Notion; este doc es el
  detalle técnico, Notion es la fuente de estado.
- Rehacer el diagnóstico (sección 1) antes de cada release mayor con la skill
  `Auditar`.
