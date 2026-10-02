import { describe, it, expect } from 'vitest'
import { expiryLabel } from '../utils/pantryView'

// 2026-10-02 review: a far expiry read "Vence 2026-10-12" (the raw ISO date)
describe('expiryLabel', () => {
  it('names the day, Spanish style', () => {
    expect(expiryLabel('ok', '2026-10-12')).toBe('Vence el 12 oct')
    expect(expiryLabel('ok', '2027-01-01')).toBe('Vence el 1 ene')
  })

  it('past and close expiries keep their words', () => {
    expect(expiryLabel('vencido', '2020-01-01')).toBe('Vencido')
    expect(expiryLabel('pronto', '2026-10-03')).toBe('Vence pronto')
  })
})
