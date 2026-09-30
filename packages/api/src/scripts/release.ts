import { fileURLToPath, pathToFileURL } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { getDb } from '../db/index.js'
import { seedTaxonomy } from './seed-taxonomy.js'

/**
 * Deploy-time release step (Railway start command, before the server boots):
 * apply pending migrations, then the production-safe base seed. Both are
 * idempotent. Uses drizzle-orm's migrator so no dev dependency (drizzle-kit) is
 * needed at runtime. Runs from dist/scripts/, so the migrations folder is
 * resolved relative to this file, not the working directory.
 */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle/migrations', import.meta.url))

export async function release(db = getDb()): Promise<void> {
  console.log('Applying migrations…')
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  await seedTaxonomy(db)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  release()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error('Release failed:', err)
      process.exit(1)
    })
}
