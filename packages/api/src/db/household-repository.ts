import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { HouseholdRole } from '@recetario/shared'
import { getDb, schema } from './index.js'
import { currentDb, inTransaction } from './transaction.js'

type MemberRow = typeof schema.householdMembers.$inferSelect

export interface MemberView {
  userId: string
  role: HouseholdRole
  invitedAt: string
  acceptedAt: string | null
}

function toMember(m: MemberRow): MemberView {
  return {
    userId: m.userId,
    role: m.role,
    invitedAt: m.invitedAt.toISOString(),
    acceptedAt: m.acceptedAt ? m.acceptedAt.toISOString() : null,
  }
}

const membership = (householdId: string, userId: string) =>
  and(
    eq(schema.householdMembers.householdId, householdId),
    eq(schema.householdMembers.userId, userId),
  )

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

  /** Creates the household with its owner as an accepted member, in one transaction. */
  async create(ownerId: string, name: string): Promise<Omit<HouseholdView, 'members'>> {
    return inTransaction(async () => {
      const db = currentDb()
      const [created] = await db.insert(schema.households).values({ name, ownerId }).returning()
      await db.insert(schema.householdMembers).values({
        householdId: created!.id,
        userId: ownerId,
        role: 'owner',
        acceptedAt: new Date(),
      })
      return {
        id: created!.id,
        name: created!.name,
        ownerId: created!.ownerId,
        createdAt: created!.createdAt.toISOString(),
      }
    })
  },

  /** True when the user is an accepted owner or admin (a pending invite grants nothing). */
  async canManage(householdId: string, userId: string): Promise<'yes' | 'no' | 'not_member'> {
    const [me] = await currentDb()
      .select()
      .from(schema.householdMembers)
      .where(membership(householdId, userId))
      .limit(1)
    if (!me) return 'not_member'
    return me.acceptedAt && (me.role === 'owner' || me.role === 'admin') ? 'yes' : 'no'
  },

  /** Adds a pending member; null when they already belong (or were invited). */
  async invite(
    householdId: string,
    userId: string,
    role: HouseholdRole,
  ): Promise<MemberView | null> {
    const [member] = await currentDb()
      .insert(schema.householdMembers)
      .values({ householdId, userId, role })
      .onConflictDoNothing()
      .returning()
    return member ? toMember(member) : null
  },

  /** Marks the user's membership accepted; null when there is none. */
  async accept(householdId: string, userId: string): Promise<MemberView | null> {
    const [member] = await currentDb()
      .update(schema.householdMembers)
      .set({ acceptedAt: new Date() })
      .where(membership(householdId, userId))
      .returning()
    return member ? toMember(member) : null
  },

  /** Removes a non-owner member (the household always keeps its owner). */
  async removeMember(householdId: string, userId: string): Promise<boolean> {
    const deleted = await currentDb()
      .delete(schema.householdMembers)
      .where(
        and(
          membership(householdId, userId),
          inArray(schema.householdMembers.role, ['admin', 'member', 'viewer']),
        ),
      )
      .returning()
    return deleted.length > 0
  },

  /**
   * Changes a non-owner member's role (the owner's role is fixed); null when
   * there is no such member. Pending invitees can be re-roled before accepting.
   */
  async changeRole(
    householdId: string,
    userId: string,
    role: Exclude<HouseholdRole, 'owner'>,
  ): Promise<MemberView | null> {
    const [member] = await currentDb()
      .update(schema.householdMembers)
      .set({ role })
      .where(
        and(
          membership(householdId, userId),
          inArray(schema.householdMembers.role, ['admin', 'member', 'viewer']),
        ),
      )
      .returning()
    return member ? toMember(member) : null
  },

  /**
   * The user leaves a household they joined. The owner can't leave (the
   * household always keeps its owner); a pending invite is declined instead.
   */
  async leave(householdId: string, userId: string): Promise<'left' | 'owner' | 'not_member'> {
    return inTransaction(async () => {
      const db = currentDb()
      const [me] = await db
        .select()
        .from(schema.householdMembers)
        .where(membership(householdId, userId))
        .limit(1)
      if (!me?.acceptedAt) return 'not_member'
      if (me.role === 'owner') return 'owner'
      await db.delete(schema.householdMembers).where(membership(householdId, userId)).returning()
      return 'left'
    })
  },

  /** The invitee turns down a pending invitation. */
  async decline(householdId: string, userId: string): Promise<boolean> {
    const deleted = await currentDb()
      .delete(schema.householdMembers)
      .where(and(membership(householdId, userId), isNull(schema.householdMembers.acceptedAt)))
      .returning()
    return deleted.length > 0
  },
}
