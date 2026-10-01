#!/usr/bin/env node
// Fails when an E2E spec exists but CI's full Playwright run doesn't list it.
// The list in .github/workflows/ci.yml is explicit (ordering + worker cap), so
// a new spec file is otherwise silently never run in CI.
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ci = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')
const specs = readdirSync(join(root, 'apps/app/e2e')).filter((f) => f.endsWith('.spec.ts'))
const missing = specs.filter((f) => !ci.includes(`e2e/${f}`))

if (missing.length > 0) {
  console.error(`E2E specs not run in CI (add them to the playwright step in ci.yml):`)
  for (const f of missing) console.error(`  - e2e/${f}`)
  process.exit(1)
}
console.log(`All ${specs.length} E2E specs are listed in ci.yml.`)
