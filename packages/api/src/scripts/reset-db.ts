/**
 * Truncates every table in the target database and reseeds the taxonomy
 * baseline (system meal categories + food types). Demo accounts and their
 * recipes are seeded separately via seed-e2e-accounts (which needs the API up).
 *
 * Point it at any database via DATABASE_URL — used by the isolated E2E stack
 * (recetario_e2e) to get a clean, known state before and after each run.
 *
 * Run: DATABASE_URL=... tsx src/scripts/reset-db.ts
 */
import { sql } from 'drizzle-orm'
import { getDb, schema } from '../db/index.js'

const MEAL_CATEGORIES = [
  { name: 'Desayuno', slug: 'desayuno', isSystem: 1 },
  { name: 'Almuerzo', slug: 'almuerzo', isSystem: 1 },
  { name: 'Cena', slug: 'cena', isSystem: 1 },
  { name: 'Postre', slug: 'postre', isSystem: 1 },
  { name: 'Snack', slug: 'snack', isSystem: 1 },
  { name: 'Bebida', slug: 'bebida', isSystem: 1 },
  { name: 'Otro', slug: 'otro', isSystem: 1 },
]

const FOOD_TYPES = [
  { name: 'Guiso', slug: 'guiso', isSystem: 1 },
  { name: 'Sopa', slug: 'sopa', isSystem: 1 },
  { name: 'Carne', slug: 'carne', isSystem: 1 },
  { name: 'Minuta', slug: 'minuta', isSystem: 1 },
  { name: 'Ensalada', slug: 'ensalada', isSystem: 1 },
  { name: 'Pasta', slug: 'pasta', isSystem: 1 },
  { name: 'Postre', slug: 'postre-tipo', isSystem: 1 },
  { name: 'Bebida', slug: 'bebida-tipo', isSystem: 1 },
  { name: 'Saludable', slug: 'saludable', isSystem: 1 },
  { name: 'Panificado', slug: 'panificado', isSystem: 1 },
  { name: 'Tarta / Empanada', slug: 'tarta', isSystem: 1 },
]

async function main() {
  const db = getDb()

  const tables = (await db.execute(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '__drizzle_migrations'`,
  )) as unknown as { tablename: string }[]
  const names = tables.map((t) => `"${t.tablename}"`).join(', ')
  if (names) {
    await db.execute(sql.raw(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`))
  }

  for (const c of MEAL_CATEGORIES) await db.insert(schema.mealCategories).values(c)
  for (const ft of FOOD_TYPES) await db.insert(schema.foodTypes).values(ft)

  console.log(`🧹 Reset ${tables.length} tables; reseeded taxonomy`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
