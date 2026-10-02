import { describe, it, expect } from 'vitest'
import {
  deleteModalTitle,
  newItemPlaceholder,
  createErrorAlert,
  usageBadgeLabel,
  usageModalTitle,
} from '../utils/configModal'

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

describe('newItemPlaceholder', () => {
  it('names what each tab creates', () => {
    expect(newItemPlaceholder('categories')).toBe('Nueva categoría')
    expect(newItemPlaceholder('food-types')).toBe('Nuevo tipo de comida')
    expect(newItemPlaceholder('tags')).toBe('Nueva etiqueta')
  })
})

describe('createErrorAlert', () => {
  it('says the name already exists on a 409', () => {
    expect(createErrorAlert(new Error('API 409: {"error":"Already exists"}'), 'Cena')).toEqual({
      title: 'Ya existe',
      message: '"Cena" ya está en la lista.',
    })
  })
  it('falls back to a generic error for anything else', () => {
    const generic = { title: 'Error', message: 'No se pudo crear el elemento.' }
    expect(createErrorAlert(new Error('API 400: {}'), 'x')).toEqual(generic)
    expect(createErrorAlert(new Error('boom API 409'), 'x')).toEqual(generic)
    expect(createErrorAlert('API 409', 'x')).toEqual(generic)
  })
  it('names the action that failed', () => {
    expect(createErrorAlert(new Error('API 500'), 'x', 'renombrar')).toEqual({
      title: 'Error',
      message: 'No se pudo renombrar el elemento.',
    })
  })
})

describe('usageBadgeLabel', () => {
  it('says how many recipes the badge opens, singular and plural', () => {
    expect(usageBadgeLabel({ name: 'Guiso', usageCount: 1 })).toBe('Ver 1 receta con "Guiso"')
    expect(usageBadgeLabel({ name: 'Cena', usageCount: 3 })).toBe('Ver 3 recetas con "Cena"')
    expect(usageBadgeLabel({ name: 'Brunch', usageCount: 0 })).toBe('Ver 0 recetas con "Brunch"')
  })
})

describe('usageModalTitle', () => {
  it('names the item, and is empty without one (never "undefined")', () => {
    expect(usageModalTitle({ name: 'Cena' })).toBe('Recetas con "Cena"')
    expect(usageModalTitle(null)).toBe('')
  })
})
