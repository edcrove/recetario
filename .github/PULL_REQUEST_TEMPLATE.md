## ¿Qué hace este PR?

<!-- Descripción clara y concisa. Una oración por bullet. -->

-

## Motivación

<!-- ¿Por qué es necesario? ¿Qué problema resuelve? Link a story/bug. -->

## Cambios principales

<!-- Archivos/componentes clave modificados y qué cambió. -->

-

## Evidencia

### ✅ CI local (`pnpm ci:local`)

<!-- Pegar el output final del pre-push hook o de pnpm ci:local -->

```
Tests:  X passed (Y files)
Build:  success
Lint:   clean
Types:  clean
```

### 📸 Screenshots / output

<!-- UI: adjuntar screenshots antes/después o grabación del flujo.
     API: output de curl/Swagger mostrando el endpoint.
     DB:  output del migration run (drizzle-kit migrate).
     Omitir si no aplica. -->

N/A

## Notion

<!-- Link directo a la story: https://app.notion.com/p/... -->

## Checklist

- [ ] `pnpm ci:local` pasó sin errores
- [ ] Sin `console.log` de debug ni `any` innecesarios
- [ ] Story en Notion → "In review" con link a este PR
- [ ] Migration incluida si hay cambios de DB
- [ ] Testeado en web + mobile si hay cambios de UI
