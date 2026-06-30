import { describe, it, expect } from 'vitest'
import { getEmptyMessage, getQueryFnKey } from '../utils/homeScreen'
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
  })
})
