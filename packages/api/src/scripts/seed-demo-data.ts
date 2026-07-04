/**
 * Extended demo seed with rich Spanish recipes for local testing.
 * Run: tsx --env-file=.env src/scripts/seed-demo-data.ts <jwt-token>
 */

import { RECIPES } from './demo-recipes-data.js'

const BASE_URL = process.env['API_URL'] ?? 'http://localhost:3000'
const TOKEN = process.argv[2] ?? process.env['DEMO_TOKEN'] ?? ''

if (!TOKEN) {
  console.error('Usage: tsx seed-demo-data.ts <jwt-token>')
  console.error('Or set DEMO_TOKEN env var')
  process.exit(1)
}

const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` }

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function main() {
  console.log(`🌱 Seeding ${RECIPES.length} demo recipes...`)
  let created = 0
  for (const recipe of RECIPES) {
    try {
      const result = (await post('/v1/recipes', recipe)) as { title: string; id: string }
      console.log(`✅ ${result.title}`)
      created++
    } catch (e) {
      console.error(`❌ ${recipe.title}: ${e instanceof Error ? e.message : e}`)
    }
  }
  console.log(`\n✨ Done: ${created}/${RECIPES.length} recipes created`)
}

main().catch(console.error)
