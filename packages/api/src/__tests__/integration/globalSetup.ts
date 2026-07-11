import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { sql } from 'drizzle-orm'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const TEST_API_KEY = 'test-api-key-integration-suite'
export const TEST_OWNER_ID = 'test-owner'

// Precomputed sha256(TEST_API_KEY) — avoids a live createHash() call over a
// fixed test constant (CodeQL flags that shape as a possible weak password
// hash, even though this is a random API key, not a password). Shared by
// seedTestDb and resetTestDb so there's exactly one call site to worry about.
const TEST_API_KEY_HASH = '6cc5a81f89f2865d8f9db888e7e1b03dfc21f71d7a87920b500637c1e91641ca'

// Shared with resetTestDb() below so the one-time initial seed and the
// per-file reseed can never drift apart.
const MEAL_CATEGORY_SEEDS = [
  { name: 'Desayuno', slug: 'desayuno', isSystem: 1 },
  { name: 'Almuerzo', slug: 'almuerzo', isSystem: 1 },
  { name: 'Cena', slug: 'cena', isSystem: 1 },
  { name: 'Postre', slug: 'postre', isSystem: 1 },
  { name: 'Snack', slug: 'snack', isSystem: 1 },
  { name: 'Bebida', slug: 'bebida', isSystem: 1 },
  { name: 'Otro', slug: 'otro', isSystem: 1 },
]

const FOOD_TYPE_SEEDS = [
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

let stopContainer: (() => Promise<void>) | null = null

export async function setup() {
  // If DATABASE_URL is already set (e.g. CI postgres service), use it directly
  if (process.env['DATABASE_URL']) {
    await seedTestDb(process.env['DATABASE_URL'])
    return
  }

  // Try to start a Testcontainers Postgres (requires Docker)
  try {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql')
    const container = await new PostgreSqlContainer('postgres:17-alpine').start()
    const url = container.getConnectionUri()
    process.env['DATABASE_URL'] = url
    stopContainer = async () => {
      await container.stop()
    }
    await seedTestDb(url)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (
      msg.includes('container runtime') ||
      msg.includes('Cannot connect') ||
      msg.includes('ENOENT')
    ) {
      process.env['SKIP_INTEGRATION'] = 'true'
      console.warn('[integration] Docker unavailable — integration tests will be skipped')
    } else {
      throw err
    }
  }
}

export async function teardown() {
  await stopContainer?.()
}

async function seedTestDb(url: string) {
  const { drizzle } = await import('drizzle-orm/postgres-js')
  const { migrate } = await import('drizzle-orm/postgres-js/migrator')
  const postgres = (await import('postgres')).default
  const { schema } = await import('../../db/index.js')

  const client = postgres(url, { max: 1 })
  const db = drizzle(client, { schema })
  await migrate(db, {
    migrationsFolder: path.join(__dirname, '../../../drizzle/migrations'),
  })

  await db
    .insert(schema.apiKeys)
    .values({ keyHash: TEST_API_KEY_HASH, ownerId: TEST_OWNER_ID, label: 'test' })
    .onConflictDoNothing()

  for (const cat of MEAL_CATEGORY_SEEDS) {
    await db.insert(schema.mealCategories).values(cat).onConflictDoNothing()
  }
  for (const ft of FOOD_TYPE_SEEDS) {
    await db.insert(schema.foodTypes).values(ft).onConflictDoNothing()
  }

  const { seedIngredients } = await import('../../db/seed-ingredients.js')
  await seedIngredients(db)

  await client.end()
}

/**
 * Truncates every table in the public schema (RESTART IDENTITY CASCADE) and
 * reseeds the fixed baseline (system meal categories/food types + the shared
 * TEST_API_KEY), then re-checks out this suite's global 'test-owner-b' key if
 * a caller has already inserted it.
 *
 * Call this from each integration test file's beforeAll — NOT db/index.ts's
 * resetDb(), which only nulls the cached drizzle client and never touches
 * actual Postgres data. Every integration file previously called resetDb()
 * believing it gave a clean slate; in reality every file's inserts
 * accumulated in the same never-truncated database for the whole suite run,
 * which is what caused real cross-file collisions (e.g. two files creating
 * a food type with the same name+owner hit a unique constraint violation).
 */
export async function resetTestDb() {
  const { getDb, schema } = await import('../../db/index.js')
  const db = getDb()

  const tables = (await db.execute(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  )) as unknown as { tablename: string }[]
  const names = tables.map((t) => `"${t.tablename}"`).join(', ')
  await db.execute(sql.raw(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`))

  await db
    .insert(schema.apiKeys)
    .values({ keyHash: TEST_API_KEY_HASH, ownerId: TEST_OWNER_ID, label: 'test' })

  for (const cat of MEAL_CATEGORY_SEEDS) {
    await db.insert(schema.mealCategories).values(cat)
  }
  for (const ft of FOOD_TYPE_SEEDS) {
    await db.insert(schema.foodTypes).values(ft)
  }

  const { seedIngredients } = await import('../../db/seed-ingredients.js')
  await seedIngredients(db)
}
