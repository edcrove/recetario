import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { getDb, schema } from '../db/index.js'
import { emailMatches } from '../db/email.js'
import { hashPassword } from '../auth/service.js'

/**
 * Admin password reset. There is no email provider yet (decision log
 * D-2026-09-30-11), so the forgot-password screen sends people to whoever runs
 * the household, who runs this against the deployed database:
 *
 *   DATABASE_URL=… pnpm --filter @recetario/api reset-password someone@example.com
 *
 * It prints a temporary password to hand over, and the user logs in with it.
 * Existing JWTs stay valid until they expire (7 days).
 */

// 12 chars from an unambiguous alphabet (no 0/O, 1/l/I) — easy to read aloud.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateTempPassword(length = 12): string {
  const bytes = randomBytes(length)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

type Db = ReturnType<typeof getDb>

/** Sets a new temporary password; returns it, or null when the email is unknown. */
export async function resetPassword(email: string, db: Db = getDb()): Promise<string | null> {
  const temp = generateTempPassword()
  const updated = await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(temp), updatedAt: new Date() })
    .where(emailMatches(email))
    .returning({ id: schema.users.id })
  return updated.length > 0 ? temp : null
}

/* v8 ignore start -- CLI entrypoint, exercised by hand against a real DB */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: pnpm --filter @recetario/api reset-password <email>')
    process.exit(1)
  }
  const temp = await resetPassword(email)
  if (!temp) {
    console.error(`No user with email ${email}`)
    process.exit(1)
  }
  console.log(`Temporary password for ${email}: ${temp}`)
  process.exit(0)
}
/* v8 ignore stop */
