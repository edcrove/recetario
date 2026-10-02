import { describe, it, expect } from 'vitest'
import type { ShoppingListEntry } from '@recetario/shared'
import { isViewerInAnyHousehold, pendingInvitations } from '../utils/roles'
import { deltaLabel, deltaStatus } from '../utils/nutritionGoals'
import { cookModeNav } from '../utils/cookModeNav'
import { shoppingQuantity } from '../utils/menuLogic'
import { expiryStatus, groupPantry } from '../utils/pantryView'
import { buildPayload, validatePayload } from '../utils/recipeForm'
import { groupShoppingByAisle } from '../utils/shoppingSections'
import { checkAllergens } from '../utils/allergenCheck'

// Cases added after mutation testing (2026-10-01): each one fails if a
// condition, boundary or method in these utils is flipped, which the earlier
// tests let through.

describe('roles: someone else being a viewer never makes me one', () => {
  it('an accepted viewer housemate does not restrict an accepted member', () => {
    const households = [
      {
        members: [
          { userId: 'me', role: 'member', acceptedAt: '2026-10-01' },
          { userId: 'other', role: 'viewer', acceptedAt: '2026-10-01' },
        ],
      },
    ]
    expect(isViewerInAnyHousehold(households, 'me')).toBe(false)
  })

  it('a household with my pending invite is listed even when others accepted', () => {
    const hh = [
      {
        id: 'a',
        members: [
          { userId: 'owner', role: 'owner', acceptedAt: '2026-09-01' },
          { userId: 'me', role: 'member', acceptedAt: null },
        ],
      },
    ]
    expect(pendingInvitations(hh, 'me').map((h) => h.id)).toEqual(['a'])
  })
})

describe('nutrition goals: the ±10% band and the sign of the delta', () => {
  it('exactly 10% off is still on target; just past it is not', () => {
    expect(deltaStatus(200, 2000)).toBe('ok')
    expect(deltaStatus(-200, 2000)).toBe('ok')
    expect(deltaStatus(201, 2000)).toBe('over')
    expect(deltaStatus(-201, 2000)).toBe('under')
  })

  it('labels each side with its own wording', () => {
    expect(deltaLabel(300, 2000)).toBe('+300 kcal sobre objetivo')
    expect(deltaLabel(-300, 2000)).toBe('faltan 300 kcal')
    expect(deltaLabel(0, 2000)).toBe('en objetivo')
    expect(deltaLabel(null, 2000)).toBe('')
    expect(deltaLabel(300, 0)).toBe('')
  })
})

describe('cook mode navigation', () => {
  it('prev goes back one step and stays on the first', () => {
    expect(cookModeNav(5, 3).prev).toBe(2)
    expect(cookModeNav(5, 0).prev).toBe(0)
  })
})

describe('shopping quantities', () => {
  it('rounds grams to tens from exactly 100 up, units below', () => {
    expect(shoppingQuantity(99.2, 'g')).toBe(100)
    expect(shoppingQuantity(100, 'g')).toBe(100)
    expect(shoppingQuantity(101, 'g')).toBe(110)
  })

  it('things bought whole round up: a third of an onion is one onion', () => {
    for (const unit of ['unit', 'clove', 'slice', 'pinch']) {
      expect(shoppingQuantity(1.3, unit)).toBe(2)
    }
    expect(shoppingQuantity(1.3, 'cup')).toBe(1.3)
  })
})

describe('pantry view', () => {
  const today = new Date(2026, 9, 1)
  it('no expiry date means no badge', () => {
    expect(expiryStatus(null, today)).toBeNull()
    expect(expiryStatus('', today)).toBeNull()
  })

  it('out-of-stock items are sorted by name too', () => {
    const item = (name: string) => ({
      id: name,
      name,
      quantity: null,
      unit: null,
      expiryDate: null,
      inStock: false,
    })
    const { outOfStock } = groupPantry([item('Zanahoria'), item('Arroz'), item('Leche')])
    expect(outOfStock.map((i) => i.name)).toEqual(['Arroz', 'Leche', 'Zanahoria'])
  })
})

describe('recipe form payload', () => {
  it('trims what people type around names, presentation, steps and notes', () => {
    const p = buildPayload(
      'Guiso',
      '4',
      'Cena',
      '',
      '  para el finde  ',
      [{ name: '  Cebolla ', quantity: '1', unit: 'unit', presentation: '  picada ' }],
      [{ text: '  Rehogar  ' }, { text: '   ' }],
    )
    expect(p.notes).toBe('para el finde')
    expect(p.ingredients[0]).toMatchObject({ name: 'Cebolla', presentation: 'picada' })
    expect(p.steps).toEqual([{ text: 'Rehogar' }])
  })

  it('reports a blank category on the category field', () => {
    const p = buildPayload(
      'Guiso',
      '4',
      ' ',
      '',
      '',
      [{ name: 'Cebolla', quantity: '1', unit: 'unit', presentation: '' }],
      [{ text: 'Rehogar' }],
    )
    const { valid, errors } = validatePayload(p)
    expect(valid).toBe(false)
    expect(errors.category).toBeTruthy()
    expect(errors.general).toBeUndefined()
  })
})

describe('shopping sections', () => {
  it('skips aisles with nothing to buy', () => {
    const entry = (ingredient: string, aisle: ShoppingListEntry['aisle']) =>
      ({ ingredient, quantity: 1, unit: null, aisle, checked: false }) as ShoppingListEntry
    const sections = groupShoppingByAisle([entry('Cebolla', 'verduleria')])
    expect(sections.map((s) => s.aisle)).toEqual(['verduleria'])
  })
})

describe('allergen check', () => {
  it('flags an allergen when ANY ingredient has it, not only when all do', () => {
    const recipe = {
      ingredients: [
        { name: 'Harina 0000', quantity: 200, unit: 'g' as const },
        { name: 'Manteca', quantity: 100, unit: 'g' as const },
      ],
      dietaryTags: [],
    }
    expect(checkAllergens(recipe as never, { allergens: ['leche'] }).matchedAllergens).toEqual([
      'leche',
    ])
  })

  it('a profile without allergens matches none', () => {
    const recipe = { ingredients: [{ name: 'Manteca', quantity: 1, unit: null }], dietaryTags: [] }
    expect(checkAllergens(recipe as never, {}).matchedAllergens).toEqual([])
  })
})
