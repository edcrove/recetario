import { eq, and } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { getDb, schema } from './index.js'

// household_members.user_id is a uuid column, but ownerId can be a legacy
// non-uuid string ('dev' fallback, API-key owners like 'test-owner'). Those
// callers can never belong to a household, and comparing them against a uuid
// column would make Postgres error out — short-circuit instead.
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Owners whose content the caller can see: themselves plus every member of
 * every household the caller belongs to. Used ONLY by read paths (recipe
 * list/detail, menu week, shopping list) — writes stay strictly owner-scoped.
 */
export async function getVisibleOwnerIds(callerId: string): Promise<string[]> {
  if (!UUID_RE.test(callerId)) return [callerId]

  const db = getDb()
  const mine = alias(schema.householdMembers, 'mine')
  const rows = await db
    .selectDistinct({ userId: schema.householdMembers.userId })
    .from(schema.householdMembers)
    .innerJoin(mine, eq(mine.householdId, schema.householdMembers.householdId))
    .where(eq(mine.userId, callerId))

  const ids = new Set<string>(rows.map((r) => r.userId))
  ids.add(callerId)
  return [...ids]
}

/**
 * True when the caller has role 'viewer' in ANY of their households.
 * Conservative rule for write-blocking: since a member's menu entries are
 * visible to every household they belong to, someone who is a viewer anywhere
 * must not create content that would surface inside that household. The
 * multi-household mixed-role edge case is documented as an open question in
 * the sharing spec.
 */
export async function isViewerAnywhere(callerId: string): Promise<boolean> {
  if (!UUID_RE.test(callerId)) return false

  const db = getDb()
  const [row] = await db
    .select({ userId: schema.householdMembers.userId })
    .from(schema.householdMembers)
    .where(
      and(eq(schema.householdMembers.userId, callerId), eq(schema.householdMembers.role, 'viewer')),
    )
    .limit(1)

  return row !== undefined
}
