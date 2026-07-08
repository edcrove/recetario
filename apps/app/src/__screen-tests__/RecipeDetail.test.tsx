import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../api/client', () => ({
  api: {
    recipes: {
      get: vi.fn().mockResolvedValue({
        id: 'test-id',
        title: 'Pasta Test',
        servings: 4,
        category: 'Cena',
        tags: [],
        images: [],
        originalLanguage: 'es',
        translations: [],
        totalTimeMin: 30,
        ingredients: [
          { name: 'Harina', quantity: 200, unit: 'g' },
          { name: 'Sal', quantity: null, unit: null },
          { name: 'Leche', quantity: 1, unit: 'cup' },
        ],
        steps: [{ text: 'Mezclar todo' }],
        notes: 'Muy rica',
        nutrition: { calories: 210, protein_g: 11, carbs_g: 17.5, fat_g: 22.7 },
      }),
    },
  },
}))

import RecipeDetailScreen from '../../app/recipe/[id]'

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('RecipeDetailScreen', () => {
  it('renders recipe title after load', async () => {
    wrap(<RecipeDetailScreen />)
    expect(await screen.findByText('Pasta Test')).toBeInTheDocument()
  })

  it('renders category and total time', async () => {
    wrap(<RecipeDetailScreen />)
    expect(await screen.findByText(/Cena/)).toBeInTheDocument()
    expect(await screen.findByText(/30 min/)).toBeInTheDocument()
  })

  it('renders ingredients', async () => {
    wrap(<RecipeDetailScreen />)
    expect(await screen.findByText(/Harina/)).toBeInTheDocument()
    expect(await screen.findByText(/Sal/)).toBeInTheDocument()
  })

  it('shows c/n for null quantity ingredients', async () => {
    wrap(<RecipeDetailScreen />)
    expect(await screen.findByText(/c\/n/)).toBeInTheDocument()
  })

  it('renders steps text', async () => {
    wrap(<RecipeDetailScreen />)
    expect(await screen.findByText('Mezclar todo')).toBeInTheDocument()
  })

  it('renders notes section', async () => {
    wrap(<RecipeDetailScreen />)
    expect(await screen.findByText('Muy rica')).toBeInTheDocument()
  })

  it('shows initial servings count', async () => {
    wrap(<RecipeDetailScreen />)
    await screen.findByText('Porciones:')
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('increments servings when + is pressed', async () => {
    wrap(<RecipeDetailScreen />)
    await screen.findByText('Porciones:')
    fireEvent.click(screen.getByText('+'))
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('decrements servings when − is pressed', async () => {
    wrap(<RecipeDetailScreen />)
    await screen.findByText('Porciones:')
    fireEvent.click(screen.getByText('−'))
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('does not decrement below 1', async () => {
    wrap(<RecipeDetailScreen />)
    await screen.findByText('Porciones:')
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByText('−'))
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })

  it('shows unit mode toggles', async () => {
    wrap(<RecipeDetailScreen />)
    expect(await screen.findByText('Cocina')).toBeInTheDocument()
    expect(screen.getByText('Métrico')).toBeInTheDocument()
    expect(screen.getByText('Imperial')).toBeInTheDocument()
  })

  it('switching to Métrico converts cup to ml', async () => {
    wrap(<RecipeDetailScreen />)
    await screen.findByText('Cocina')
    fireEvent.click(screen.getByText('Métrico'))
    expect(await screen.findByText(/ml/)).toBeInTheDocument()
  })

  it('shows Iniciar cocina button when steps are present', async () => {
    wrap(<RecipeDetailScreen />)
    expect(await screen.findByText('Iniciar cocina')).toBeInTheDocument()
  })

  it('shows Editar link', async () => {
    wrap(<RecipeDetailScreen />)
    expect(await screen.findByText('Editar')).toBeInTheDocument()
  })

  it('shows fixed per-serving nutrition alongside the scaled total for the selected servings', async () => {
    wrap(<RecipeDetailScreen />)
    expect(await screen.findByText('Nutrición por porción')).toBeInTheDocument()
    expect(screen.getByText('Nutrición por cantidad de porciones')).toBeInTheDocument()
    // base servings = 4: per-porción stays 210, cantidad-de-porciones starts at 210*4=840
    expect(screen.getByText('210')).toBeInTheDocument()
    expect(screen.getByText('840')).toBeInTheDocument()
  })

  it('updates only the cantidad-de-porciones total when servings is incremented, not the per-porción figure', async () => {
    wrap(<RecipeDetailScreen />)
    await screen.findByText('Nutrición por porción')
    fireEvent.click(screen.getByText('+'))
    // servings now 5: cantidad-de-porciones total becomes 210*5=1050, per-porción unchanged at 210
    expect(await screen.findByText('1050')).toBeInTheDocument()
    expect(screen.getByText('210')).toBeInTheDocument()
  })
})
