import { describe, it, expect } from 'vitest'
import { deleteModalTitle } from '../utils/configModal'

describe('deleteModalTitle', () => {
  it('is empty without a target (never "undefined")', () => {
    expect(deleteModalTitle(null)).toBe('')
  })
  it('asks to confirm a deletable item', () => {
    expect(deleteModalTitle({ name: 'Postre', usageCount: 0, isDeletable: true })).toBe(
      '¿Eliminar "Postre"?',
    )
  })
  it('counts recipes with singular and plural', () => {
    expect(deleteModalTitle({ name: 'Guiso', usageCount: 1, isDeletable: false })).toBe(
      '"Guiso" está en 1 receta',
    )
    expect(deleteModalTitle({ name: 'Guiso', usageCount: 3, isDeletable: false })).toBe(
      '"Guiso" está en 3 recetas',
    )
  })
})
