import { eq } from 'drizzle-orm'
import { normalizeAllergens, type NutritionTargets, type Profile } from '@recetario/shared'
import { schema } from './index.js'
import { emailMatches, normalizeEmail } from './email.js'
import { currentDb, inTransaction } from './transaction.js'

type UserRow = typeof schema.users.$inferSelect
type ProfileRow = typeof schema.userProfiles.$inferSelect

/** Fields of the profile a user can change (allergens already normalized to keys). */
export interface ProfileUpdate {
  preferredServings?: number
  dietaryRestrictions?: string[]
  allergens?: string[]
  goals?: string[]
  timezone?: string
  nutritionTargets?: NutritionTargets
}

function toProfile(row: ProfileRow): Profile {
  return {
    preferredServings: row.preferredServings ?? null,
    dietaryRestrictions: row.dietaryRestrictions as string[],
    allergens: normalizeAllergens(row.allergens as string[]),
    goals: row.goals as string[],
    timezone: row.timezone ?? null,
    nutritionTargets: (row.nutritionTargets as NutritionTargets | null) ?? null,
  }
}

/**
 * Users and their profiles. Routes go through here instead of querying the
 * tables directly (2026-10-01 audit, Clean code).
 */
export const accountRepository = {
  async findUserById(id: string): Promise<UserRow | null> {
    const [user] = await currentDb()
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1)
    return user ?? null
  },

  /** Case-insensitive: emails are stored lowercased and compared that way. */
  async findUserByEmail(email: string): Promise<UserRow | null> {
    const [user] = await currentDb().select().from(schema.users).where(emailMatches(email)).limit(1)
    return user ?? null
  },

  /** Creates the user and their empty profile in one transaction. */
  async createUser(input: {
    email: string
    passwordHash: string
    displayName: string | null
  }): Promise<UserRow> {
    return inTransaction(async () => {
      const db = currentDb()
      const [user] = await db
        .insert(schema.users)
        .values({ ...input, email: normalizeEmail(input.email) })
        .returning()
      await db.insert(schema.userProfiles).values({ userId: user!.id }).onConflictDoNothing()
      return user!
    })
  },

  async recordLogin(id: string): Promise<void> {
    await currentDb()
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, id))
  },

  async updateUser(
    id: string,
    updates: { displayName?: string; avatarUrl?: string },
  ): Promise<UserRow | null> {
    const [user] = await currentDb()
      .update(schema.users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.users.id, id))
      .returning()
    return user ?? null
  },

  /**
   * Stores a new password hash and stamps passwordChangedAt, which revokes
   * every JWT issued before now (see middleware/auth.ts isRevoked).
   */
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const now = new Date()
    await currentDb()
      .update(schema.users)
      .set({ passwordHash, passwordChangedAt: now, updatedAt: now })
      .where(eq(schema.users.id, id))
  },

  async findProfileRow(userId: string): Promise<ProfileRow | null> {
    const [row] = await currentDb()
      .select()
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, userId))
      .limit(1)
    return row ?? null
  },

  async findProfile(userId: string): Promise<Profile | null> {
    const row = await accountRepository.findProfileRow(userId)
    return row ? toProfile(row) : null
  },

  /** Creates the profile on first write; returns it as stored. */
  async upsertProfile(userId: string, updates: ProfileUpdate): Promise<Profile> {
    if (Object.keys(updates).length === 0) {
      // Nothing to set: make sure the row exists and return it
      await currentDb().insert(schema.userProfiles).values({ userId }).onConflictDoNothing()
      return toProfile((await accountRepository.findProfileRow(userId))!)
    }
    const [row] = await currentDb()
      .insert(schema.userProfiles)
      .values({ userId, ...updates })
      .onConflictDoUpdate({ target: schema.userProfiles.userId, set: updates })
      .returning()
    return toProfile(row!)
  },
}
