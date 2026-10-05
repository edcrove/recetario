import { describe, it, expect } from 'vitest'
import { joinedDiners, whoFor, withDiners } from '../utils/householdDiners'

const sofi = {
  id: 'd1',
  householdId: 'h1',
  name: 'Sofi',
  allergens: ['mani'],
  dietaryRestrictions: ['vegetariano'],
}
const juan = { ...sofi, id: 'd2', householdId: 'h2', name: 'Juan', allergens: ['gluten'] }

// Story (Auditar 2026-10-03): a kid's allergies warn every member.
describe('joinedDiners', () => {
  const households = [
    { members: [{ userId: 'me', acceptedAt: '2026-10-01' }], diners: [sofi] },
    { members: [{ userId: 'me', acceptedAt: null }], diners: [juan] },
    { members: [{ userId: 'otro', acceptedAt: '2026-10-01' }] },
    { diners: [juan] },
    // An older API answer without diners
    { members: [{ userId: 'me', acceptedAt: '2026-10-01' }] },
  ]

  it("takes only the households I joined, not a pending invite's", () => {
    expect(joinedDiners(households, 'me')).toEqual([sofi])
  })

  it('nothing before the households or the session load', () => {
    expect(joinedDiners(undefined, 'me')).toEqual([])
    expect(joinedDiners(households, null)).toEqual([])
  })
})

describe('withDiners', () => {
  it('adds every diner to my own restrictions, once each', () => {
    const profile = { allergens: ['Maní'], dietaryRestrictions: ['vegano'], goals: ['x'] }
    expect(withDiners(profile, [sofi, juan])).toEqual({
      allergens: ['mani', 'gluten'],
      dietaryRestrictions: ['vegano', 'vegetariano'],
      goals: ['x'],
    })
  })

  it('works on an empty profile, and leaves it alone with no diners', () => {
    expect(withDiners({}, [sofi])).toEqual({
      allergens: ['mani'],
      dietaryRestrictions: ['vegetariano'],
    })
    const profile = { allergens: ['leche'] }
    expect(withDiners(profile, [])).toBe(profile)
  })
})

describe('whoFor', () => {
  it('names me first, then each diner it is for', () => {
    expect(whoFor('mani', { allergens: ['maní'] }, [sofi, juan])).toEqual(['vos', 'Sofi'])
    expect(whoFor('gluten', {}, [sofi, juan])).toEqual(['Juan'])
    expect(whoFor('vegetariano', { dietaryRestrictions: [] }, [sofi])).toEqual(['Sofi'])
  })

  it('a legacy free-text allergen matches as itself', () => {
    expect(whoFor('kiwi', { allergens: ['kiwi'] }, [])).toEqual(['vos'])
    expect(whoFor('kiwi', {}, [sofi])).toEqual([])
  })
})
