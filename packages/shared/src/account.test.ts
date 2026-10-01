import { describe, it, expect } from 'vitest'
import { HouseholdSchema, PantryItemSchema, ProfileSchema, UserSchema } from './account.js'

const id = '550e8400-e29b-41d4-a716-446655440000'

describe('account contracts', () => {
  it('accept the API shapes', () => {
    expect(
      UserSchema.parse({ id, email: 'a@b.co', displayName: null, createdAt: '2026-07-01' }),
    ).toMatchObject({ id })
    expect(
      HouseholdSchema.parse({
        id,
        name: 'Casa',
        ownerId: id,
        createdAt: 'x',
        members: [{ userId: id, role: 'viewer', invitedAt: 'x', acceptedAt: null }],
      }).members?.[0]?.role,
    ).toBe('viewer')
    expect(
      PantryItemSchema.parse({
        id,
        ownerId: 'o',
        name: 'Sal',
        quantity: null,
        unit: null,
        expiryDate: null,
        inStock: true,
      }).inStock,
    ).toBe(true)
    expect(
      ProfileSchema.parse({
        preferredServings: 2,
        dietaryRestrictions: [],
        allergens: ['leche'],
        goals: [],
        timezone: 'UTC',
        nutritionTargets: null,
      }).allergens,
    ).toEqual(['leche'])
  })

  it('reject unknown household roles', () => {
    expect(
      HouseholdSchema.safeParse({
        id,
        name: 'C',
        ownerId: id,
        createdAt: 'x',
        members: [{ userId: id, role: 'guest', invitedAt: 'x', acceptedAt: null }],
      }).success,
    ).toBe(false)
  })
})
