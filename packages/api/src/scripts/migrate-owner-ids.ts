/**
 * Migration script: creates a demo user for existing 'dev' ownerId data,
 * then adds FK constraint on api_keys.owner_id → users.id.
 * Safe to run multiple times (idempotent).
 */
import { getDb, schema } from '../db/index.js'
import { sql, eq } from 'drizzle-orm'
import { hashPassword } from '../auth/service.js'

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'
const DEMO_EMAIL = 'demo@recetario.app'

export async function migrateOwnerIds(): Promise<void> {
  const db = getDb()

  // 1. Create demo user if not exists
  const demoPasswordHash = await hashPassword('demo-password-change-me')
  await db
    .insert(schema.users)
    .values({
      id: DEMO_USER_ID,
      email: DEMO_EMAIL,
      passwordHash: demoPasswordHash,
      displayName: 'Demo User',
    })
    .onConflictDoNothing()

  await db.insert(schema.userProfiles).values({ userId: DEMO_USER_ID }).onConflictDoNothing()

  console.log(`Demo user ensured: ${DEMO_USER_ID}`)

  // 2. Update api_keys rows where owner_id = 'dev' → DEMO_USER_ID
  // (owner_id is currently text, not yet a FK)
  const updatedKeys = await db
    .update(schema.apiKeys)
    .set({ ownerId: DEMO_USER_ID })
    .where(eq(schema.apiKeys.ownerId, 'dev'))
    .returning()

  console.log(`Updated ${updatedKeys.length} api_keys rows from 'dev' to demo user`)

  // 3. Add FK constraint via raw SQL (only if not exists)
  try {
    await db.execute(sql`
      ALTER TABLE api_keys
      ADD CONSTRAINT api_keys_owner_id_fk
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    `)
    console.log('FK constraint added to api_keys.owner_id')
  } catch {
    console.log('FK constraint already exists or could not be added — skipping')
  }

  console.log('Migration complete.')
}

if (process.env['NODE_ENV'] !== 'test') {
  migrateOwnerIds()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err)
      process.exit(1)
    })
}
