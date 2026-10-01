import { describe, it, expect } from 'vitest'
import { getEmptyMessage, isFirstRun, getQueryFnKey, homeSearchParams } from '../utils/homeScreen'
import type { Recipe } from '@recetario/shared'

const baseRecipe: Recipe = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Pasta Boloñesa',
  servings: 4,
  category: 'Cena',
  tags: ['pasta', 'italiana'],
  ingredients: [{ name: 'pasta', quantity: 200, unit: 'g' }],
  steps: [],
  images: [],
  translations: [],
  originalLanguage: 'es',
}

describe('HomeScreen logic', () => {
  it('shows recipe list when data is available', () => {
    const recipes: Recipe[] = [baseRecipe]
    expect(recipes.length).toBeGreaterThan(0)
    expect(recipes[0]?.title).toBe('Pasta Boloñesa')
  })

  it('shows "Sin resultados" when query is set but list is empty', () => {
    expect(getEmptyMessage('pasta', [])).toBe('Sin resultados')
  })

  it('shows "No hay recetas aún" when no query and list is empty', () => {
    expect(getEmptyMessage('', [])).toBe('No hay recetas aún')
  })

  it('shows "Sin resultados" when a filter is active and the list is empty', () => {
    expect(getEmptyMessage('', [], true)).toBe('Sin resultados')
  })

  it('returns empty string when recipes are present', () => {
    expect(getEmptyMessage('pasta', [baseRecipe])).toBe('')
    expect(getEmptyMessage('', [baseRecipe])).toBe('')
  })

  it('calls search when query is non-empty', () => {
    expect(getQueryFnKey('pasta')).toBe('search')
    expect(getQueryFnKey('  arroz  ')).toBe('search')
  })

  it('calls list when query is empty or whitespace', () => {
    expect(getQueryFnKey('')).toBe('list')
    expect(getQueryFnKey('   ')).toBe('list')
    expect(getQueryFnKey('', null)).toBe('list')
  })

  it('calls search when a food type is selected, even without a query', () => {
    expect(getQueryFnKey('', 'ft-1')).toBe('search')
    expect(getQueryFnKey('pasta', 'ft-1')).toBe('search')
  })
})

describe('isFirstRun', () => {
  it('is true only with no recipes, no query and no filters', () => {
    expect(isFirstRun('', [], false)).toBe(true)
    expect(isFirstRun('', [])).toBe(true)
    expect(isFirstRun('pollo', [], false)).toBe(false)
    expect(isFirstRun('', [], true)).toBe(false)
    expect(isFirstRun('', [{ id: 'x' } as never], false)).toBe(false)
  })
})

// Story "App: dietary tags picker in recipe form + allergen warning": "Home
// screen: dietary filter in search combines with food type filter".
describe('home diet filter', () => {
  it('a diet alone goes through search (the list endpoint cannot filter by diet)', () => {
    expect(getQueryFnKey('', null, 'vegano')).toBe('search')
    expect(getQueryFnKey('', null, null)).toBe('list')
  })

  it('combines text, food type and diet in one search', () => {
    expect(homeSearchParams(' tarta ', 'ft-1', 'sin-gluten')).toEqual({
      q: 'tarta',
      foodTypeId: 'ft-1',
      dietary: 'sin-gluten',
    })
  })

  it('leaves unset filters out instead of sending them empty', () => {
    expect(homeSearchParams('', null, 'vegano')).toEqual({ dietary: 'vegano' })
    expect(homeSearchParams('  ', 'ft-1', null)).toEqual({ foodTypeId: 'ft-1' })
    expect(homeSearchParams('', null, null)).toEqual({})
  })
})
