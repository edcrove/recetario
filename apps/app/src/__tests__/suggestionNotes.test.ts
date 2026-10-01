import { describe, it, expect } from 'vitest'
import { suggestionNotes } from '../utils/suggestionNotes'

describe('suggestionNotes', () => {
  it('explains expiring items, rating and recency', () => {
    expect(
      suggestionNotes({ usesExpiring: ['leche', 'pollo'], avgRating: 4, recentlyCooked: true }),
    ).toEqual(['Aprovechá lo que vence: leche, pollo', '★ 4.0', 'La cocinaste hace poco'])
  })
  it('is empty without signals (older API responses included)', () => {
    expect(suggestionNotes({})).toEqual([])
    expect(suggestionNotes({ usesExpiring: [], avgRating: null, recentlyCooked: false })).toEqual(
      [],
    )
  })
})
