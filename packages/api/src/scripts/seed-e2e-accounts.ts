/**
 * Registers (or reuses) one demo account per Playwright E2E worker and seeds
 * each with the same demo recipes. Keep EMAILS in sync with the account list
 * in apps/app/e2e/demoAccounts.ts — the two must match 1:1 or a worker will
 * fail fast with "no demo account configured" instead of silently sharing
 * an account with another worker.
 *
 * Run: pnpm --filter @recetario/api seed:e2e-accounts
 */

import { RECIPES } from './demo-recipes-data.js'

const BASE_URL = process.env['API_URL'] ?? 'http://localhost:3000'
const PASSWORD = 'demo1234'
const EMAILS = [
  'demo@recetario.app',
  'demo2@recetario.app',
  'demo3@recetario.app',
  'demo4@recetario.app',
]

async function getOrCreateToken(email: string): Promise<string> {
  const login = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  if (login.ok) {
    const { token } = (await login.json()) as { token: string }
    return token
  }

  const register = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  if (!register.ok) {
    throw new Error(`Could not register ${email}: ${register.status} ${await register.text()}`)
  }
  const { token } = (await register.json()) as { token: string }
  return token
}

async function seedAccount(email: string): Promise<void> {
  const token = await getOrCreateToken(email)
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const existing = await fetch(`${BASE_URL}/v1/recipes`, { headers })
  const recipes = (await existing.json()) as unknown[]
  if (Array.isArray(recipes) && recipes.length > 0) {
    console.log(`⏭  ${email} already has ${recipes.length} recipes, skipping`)
    return
  }

  let created = 0
  for (const recipe of RECIPES) {
    const res = await fetch(`${BASE_URL}/v1/recipes`, {
      method: 'POST',
      headers,
      body: JSON.stringify(recipe),
    })
    if (res.ok) created++
    else console.error(`❌ ${email} — ${recipe.title}: ${res.status} ${await res.text()}`)
  }
  console.log(`✅ ${email} — seeded ${created}/${RECIPES.length} recipes`)
}

async function main() {
  console.log(`🌱 Seeding ${EMAILS.length} E2E demo accounts...`)
  for (const email of EMAILS) {
    await seedAccount(email)
  }
  console.log('\n✨ Done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
