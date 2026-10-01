import { eq, inArray } from 'drizzle-orm'
import { getDb, schema } from './index.js'

export interface HouseholdView {
  id: string
  name: string
  ownerId: string
  createdAt: string
  members: {
    userId: string
    role: 'owner' | 'admin' | 'member' | 'viewer'
    invitedAt: string
    acceptedAt: string | null
    displayName: string | null
    email: string
  }[]
}

export const householdRepository = {
  /**
   * Every household the user belongs to (pending invites included), each with
   * its members' names and emails so the app shows people, not ids. Two
   * queries regardless of how many households or members there are.
   */
  async listForUser(userId: string): Promise<HouseholdView[]> {
    const db = getDb()
    const memberships = await db
      .select({ household: schema.households })
      .from(schema.householdMembers)
      .innerJoin(schema.households, eq(schema.householdMembers.householdId, schema.households.id))
      .where(eq(schema.householdMembers.userId, userId))
    if (memberships.length === 0) return []

    const members = await db
      .select({
        member: schema.householdMembers,
        displayName: schema.users.displayName,
        email: schema.users.email,
      })
      .from(schema.householdMembers)
      .innerJoin(schema.users, eq(schema.householdMembers.userId, schema.users.id))
      .where(
        inArray(
          schema.householdMembers.householdId,
          memberships.map(({ household }) => household.id),
        ),
      )

    return memberships.map(({ household }) => ({
      id: household.id,
      name: household.name,
      ownerId: household.ownerId,
      createdAt: household.createdAt.toISOString(),
      members: members
        .filter(({ member }) => member.householdId === household.id)
        .map(({ member: m, displayName, email }) => ({
          userId: m.userId,
          role: m.role,
          invitedAt: m.invitedAt.toISOString(),
          acceptedAt: m.acceptedAt ? m.acceptedAt.toISOString() : null,
          displayName,
          email,
        })),
    }))
  },
}
