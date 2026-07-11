import { describe, it, expect } from 'vitest'
import { groupCanonicals, type CanonicalItem } from './ingredientGroups'

const c = (over: Partial<CanonicalItem>): CanonicalItem => ({
  id: 'x',
  name: 'X',
  familyName: null,
  isSystem: true,
  synonyms: [],
  ...over,
})

describe('groupCanonicals', () => {
  it('groups by family alphabetically with "Sin familia" last', () => {
    const groups = groupCanonicals(
      [
        c({ id: '1', name: 'Pollo', familyName: 'pollo' }),
        c({ id: '2', name: 'Tomate', familyName: null }),
        c({ id: '3', name: 'Bife', familyName: 'vacuno' }),
      ],
      '',
    )
    expect(groups.map((g) => g.family)).toEqual(['pollo', 'vacuno', 'Sin familia'])
  })

  it('sorts canonicals within a family by name', () => {
    const groups = groupCanonicals(
      [
        c({ id: '1', name: 'Pata de pollo', familyName: 'pollo' }),
        c({ id: '2', name: 'Alita de pollo', familyName: 'pollo' }),
      ],
      '',
    )
    expect(groups[0]!.canonicals.map((x) => x.name)).toEqual(['Alita de pollo', 'Pata de pollo'])
  })

  it('filters by canonical name (case-insensitive)', () => {
    const groups = groupCanonicals(
      [c({ id: '1', name: 'Pollo' }), c({ id: '2', name: 'Tomate' })],
      'pol',
    )
    expect(groups.flatMap((g) => g.canonicals).map((x) => x.name)).toEqual(['Pollo'])
  })

  it('filters by a synonym too', () => {
    const groups = groupCanonicals(
      [
        c({ id: '1', name: 'Pollo', synonyms: [{ id: 's', synonym: 'pechuga', isSystem: true }] }),
        c({ id: '2', name: 'Tomate' }),
      ],
      'pechuga',
    )
    expect(groups.flatMap((g) => g.canonicals).map((x) => x.name)).toEqual(['Pollo'])
  })

  it('returns everything when the search is blank', () => {
    const groups = groupCanonicals([c({ id: '1', name: 'Pollo' })], '   ')
    expect(groups.flatMap((g) => g.canonicals)).toHaveLength(1)
  })
})
