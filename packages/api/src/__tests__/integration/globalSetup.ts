import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const TEST_API_KEY = 'test-api-key-integration-suite'
export const TEST_OWNER_ID = 'test-owner'

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
  const { createHash } = await import('node:crypto')
  const { schema } = await import('../../db/index.js')

  const client = postgres(url, { max: 1 })
  const db = drizzle(client, { schema })
  await migrate(db, {
    migrationsFolder: path.join(__dirname, '../../../drizzle/migrations'),
  })

  const keyHash = createHash('sha256').update(TEST_API_KEY).digest('hex')
  await db
    .insert(schema.apiKeys)
    .values({ keyHash, ownerId: TEST_OWNER_ID, label: 'test' })
    .onConflictDoNothing()

  // Seed system meal categories
  const mealCategorySeeds = [
    { name: 'Desayuno', slug: 'desayuno', isSystem: 1 },
    { name: 'Almuerzo', slug: 'almuerzo', isSystem: 1 },
    { name: 'Cena', slug: 'cena', isSystem: 1 },
    { name: 'Postre', slug: 'postre', isSystem: 1 },
    { name: 'Snack', slug: 'snack', isSystem: 1 },
    { name: 'Bebida', slug: 'bebida', isSystem: 1 },
    { name: 'Otro', slug: 'otro', isSystem: 1 },
  ]
  for (const cat of mealCategorySeeds) {
    await db.insert(schema.mealCategories).values(cat).onConflictDoNothing()
  }

  // Seed system food types
  const foodTypeSeeds = [
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
  for (const ft of foodTypeSeeds) {
    await db.insert(schema.foodTypes).values(ft).onConflictDoNothing()
  }

  await client.end()
}
