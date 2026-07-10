import { describe, it, expect } from 'vitest'
import { deltaStatus, deltaLabel } from '../utils/nutritionGoals'

describe('deltaStatus', () => {
  it('is ok within ±10% of target', () => {
    expect(deltaStatus(50, 2000)).toBe('ok') // 2.5%
    expect(deltaStatus(-150, 2000)).toBe('ok') // 7.5%
  })
  it('is over when above tolerance', () => {
    expect(deltaStatus(300, 2000)).toBe('over')
  })
  it('is under when below tolerance', () => {
    expect(deltaStatus(-400, 2000)).toBe('under')
  })
  it('is none when no delta or no target', () => {
    expect(deltaStatus(null, 2000)).toBe('none')
    expect(deltaStatus(100, 0)).toBe('none')
  })
})

describe('deltaLabel', () => {
  it('says how much is missing when under', () => {
    expect(deltaLabel(-300, 2000)).toBe('faltan 300')
  })
  it('says how much over when above', () => {
    expect(deltaLabel(250, 2000)).toBe('+250 sobre objetivo')
  })
  it('says on target when within tolerance', () => {
    expect(deltaLabel(50, 2000)).toBe('en objetivo')
  })
  it('is empty when no target', () => {
    expect(deltaLabel(100, 0)).toBe('')
    expect(deltaLabel(null, 2000)).toBe('')
  })
})
