import { describe, it, expect } from 'vitest'
import { macroStrip } from '../utils/macroStrip'

describe('macroStrip', () => {
  it('formats per-serving macros rounded to integers', () => {
    expect(macroStrip({ calories: 419.6, protein_g: 27.8, carbs_g: 52.3, fat_g: 11.5 })).toBe(
      '420 kcal · 28P · 52C · 12G',
    )
  })

  it('returns null when there is no nutrition', () => {
    expect(macroStrip(null)).toBeNull()
    expect(macroStrip(undefined)).toBeNull()
  })
})
