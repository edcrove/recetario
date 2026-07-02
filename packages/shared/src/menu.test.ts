import { describe, it, expect } from 'vitest'
import { MenuSlotSchema, MenuEntrySchema, CreateMenuEntrySchema, MenuWeekSchema } from './menu.js'

describe('MenuSlotSchema', () => {
  it.each(['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Snacks/Otros'])(
    'accepts valid slot: %s',
    (slot) => {
      expect(MenuSlotSchema.parse(slot)).toBe(slot)
    },
  )

  it('rejects invalid slot', () => {
    expect(() => MenuSlotSchema.parse('Brunch')).toThrow()
  })

  it('rejects empty string', () => {
    expect(() => MenuSlotSchema.parse('')).toThrow()
  })
})

describe('CreateMenuEntrySchema', () => {
  const valid = {
    date: '2026-06-29',
    slot: 'Almuerzo',
    recipeId: '550e8400-e29b-41d4-a716-446655440000',
  }

  it('defaults servings to 1', () => {
    const result = CreateMenuEntrySchema.parse(valid)
    expect(result.servings).toBe(1)
  })

  it('accepts explicit servings', () => {
    const result = CreateMenuEntrySchema.parse({ ...valid, servings: 4 })
    expect(result.servings).toBe(4)
  })

  it('rejects non-positive servings', () => {
    expect(() => CreateMenuEntrySchema.parse({ ...valid, servings: 0 })).toThrow()
    expect(() => CreateMenuEntrySchema.parse({ ...valid, servings: -1 })).toThrow()
  })

  it('rejects non-integer servings', () => {
    expect(() => CreateMenuEntrySchema.parse({ ...valid, servings: 1.5 })).toThrow()
  })

  it('rejects invalid date format', () => {
    expect(() => CreateMenuEntrySchema.parse({ ...valid, date: 'not-a-date' })).toThrow()
    expect(() => CreateMenuEntrySchema.parse({ ...valid, date: '2026-6-1' })).toThrow()
    expect(() => CreateMenuEntrySchema.parse({ ...valid, date: '06/29/2026' })).toThrow()
  })

  it('accepts valid YYYY-MM-DD date', () => {
    const result = CreateMenuEntrySchema.parse(valid)
    expect(result.date).toBe('2026-06-29')
  })

  it('rejects invalid recipeId (not UUID)', () => {
    expect(() => CreateMenuEntrySchema.parse({ ...valid, recipeId: 'abc' })).toThrow()
  })
})

describe('MenuEntrySchema', () => {
  const valid = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    ownerId: 'owner-1',
    date: '2026-06-29',
    slot: 'Cena',
    recipeId: '550e8400-e29b-41d4-a716-446655440001',
    servings: 2,
    createdAt: '2026-06-29T12:00:00Z',
    updatedAt: '2026-06-29T12:00:00Z',
  }

  it('accepts a valid entry', () => {
    expect(() => MenuEntrySchema.parse(valid)).not.toThrow()
  })

  it('allows optional recipeName', () => {
    const result = MenuEntrySchema.parse({ ...valid, recipeName: 'Pasta' })
    expect(result.recipeName).toBe('Pasta')
  })

  it('rejects missing required fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...noId } = valid
    expect(() => MenuEntrySchema.parse(noId)).toThrow()
  })
})

describe('MenuWeekSchema', () => {
  it('accepts valid week with empty entries', () => {
    const result = MenuWeekSchema.parse({ weekStart: '2026-06-29', entries: [] })
    expect(result.entries).toEqual([])
  })

  it('rejects invalid weekStart format', () => {
    expect(() => MenuWeekSchema.parse({ weekStart: 'invalid', entries: [] })).toThrow()
  })
})
