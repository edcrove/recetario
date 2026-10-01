import { describe, it, expect } from 'vitest'
import { accountRepository } from '../../db/account-repository.js'
import { getDb, schema } from '../../db/index.js'
import { eq } from 'drizzle-orm'

const skip = process.env['SKIP_INTEGRATION'] === 'true'

describe.skipIf(skip)('accountRepository', () => {
  const stamp = Date.now()

  it('creates a user with an empty profile, finds it by id and any-case email', async () => {
    const user = await accountRepository.createUser({
      email: `Repo.${stamp}@Example.com`,
      passwordHash: 'x',
      displayName: null,
    })
    expect(user.email).toBe(`repo.${stamp}@example.com`)
    expect((await accountRepository.findUserById(user.id))?.id).toBe(user.id)
    expect((await accountRepository.findUserByEmail(`REPO.${stamp}@example.com`))?.id).toBe(user.id)
    expect(await accountRepository.findProfile(user.id)).toEqual({
      preferredServings: 2,
      dietaryRestrictions: [],
      allergens: [],
      goals: [],
      timezone: 'UTC',
      nutritionTargets: null,
    })

    await accountRepository.recordLogin(user.id)
    expect((await accountRepository.findUserById(user.id))?.lastLoginAt).toBeInstanceOf(Date)

    const renamed = await accountRepository.updateUser(user.id, { displayName: 'Repo' })
    expect(renamed?.displayName).toBe('Repo')
  })

  it('returns null for unknown users and profiles', async () => {
    const ghost = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed'
    expect(await accountRepository.findUserById(ghost)).toBeNull()
    expect(await accountRepository.findUserByEmail(`nobody.${stamp}@example.com`)).toBeNull()
    expect(await accountRepository.updateUser(ghost, { displayName: 'X' })).toBeNull()
    expect(await accountRepository.findProfile(ghost)).toBeNull()
  })

  it('upserts the profile, and an empty update recreates a missing row', async () => {
    const user = await accountRepository.createUser({
      email: `upsert.${stamp}@example.com`,
      passwordHash: 'x',
      displayName: null,
    })
    const updated = await accountRepository.upsertProfile(user.id, {
      allergens: ['leche'],
      timezone: 'America/Montevideo',
    })
    expect(updated.allergens).toEqual(['leche'])
    expect(updated.timezone).toBe('America/Montevideo')

    await getDb().delete(schema.userProfiles).where(eq(schema.userProfiles.userId, user.id))
    const recreated = await accountRepository.upsertProfile(user.id, {})
    expect(recreated.allergens).toEqual([])
    expect(await accountRepository.findProfile(user.id)).not.toBeNull()
  })

  it('reads an unset preferred servings as null', async () => {
    const user = await accountRepository.createUser({
      email: `servings.${stamp}@example.com`,
      passwordHash: 'x',
      displayName: null,
    })
    await getDb()
      .update(schema.userProfiles)
      .set({ preferredServings: null })
      .where(eq(schema.userProfiles.userId, user.id))
    expect((await accountRepository.findProfile(user.id))?.preferredServings).toBeNull()
  })
})
