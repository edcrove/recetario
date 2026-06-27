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
  } catch {
    // Docker not available — mark integration tests to be skipped
    process.env['SKIP_INTEGRATION'] = 'true'
    console.warn('[integration] Docker unavailable — integration tests will be skipped')
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
    migrationsFolder: path.join(__dirname, '../../../../drizzle/migrations'),
  })

  const keyHash = createHash('sha256').update(TEST_API_KEY).digest('hex')
  // Insert only if not already present (idempotent)
  await db
    .insert(schema.apiKeys)
    .values({ keyHash, ownerId: TEST_OWNER_ID, label: 'test' })
    .onConflictDoNothing()
  await client.end()
}
