import { sql } from 'drizzle-orm'
import { schema } from './index.js'

/** Emails are stored and compared case-insensitively (and trimmed). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** WHERE clause matching a user by email regardless of case. */
export function emailMatches(email: string) {
  return sql`lower(${schema.users.email}) = ${normalizeEmail(email)}`
}
