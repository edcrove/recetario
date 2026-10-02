import { eq } from 'drizzle-orm'
import { currentDb } from './transaction.js'
import { schema } from './index.js'
import { UUID_RE } from './household-visibility.js'

/** The user's IANA time zone from their profile; UTC for API-key owners or when unset. */
export async function userTimeZone(ownerId: string): Promise<string> {
  if (!UUID_RE.test(ownerId)) return 'UTC'
  const [profile] = await currentDb()
    .select({ timezone: schema.userProfiles.timezone })
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, ownerId))
    .limit(1)
  return profile?.timezone ?? 'UTC'
}

/** Today's date (YYYY-MM-DD) where the user is — not the server's UTC day. */
export async function userToday(ownerId: string, now = new Date()): Promise<string> {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: await userTimeZone(ownerId) }).format(now)
}
