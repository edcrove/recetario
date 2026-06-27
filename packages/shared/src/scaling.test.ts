import { describe, expect, it } from 'vitest'
import { scaleQuantity } from './scaling.js'

describe('scaleQuantity', () => {
  it('scales up (200 * 8/4 = 400)', () => {
    expect(scaleQuantity(200, 4, 8)).toBe(400)
  })

  it('scales down (200 * 2/4 = 100)', () => {
    expect(scaleQuantity(200, 4, 2)).toBe(100)
  })

  it('passes null through unchanged', () => {
    expect(scaleQuantity(null, 4, 8)).toBeNull()
  })

  it('rounds to 2 decimals (1 * 1/3 = 0.33)', () => {
    expect(scaleQuantity(1, 3, 1)).toBe(0.33)
  })

  it('throws when baseServings is 0', () => {
    expect(() => scaleQuantity(100, 0, 4)).toThrow('baseServings must be > 0')
  })

  it('returns same value when baseServings equals targetServings', () => {
    expect(scaleQuantity(150, 4, 4)).toBe(150)
  })
})
