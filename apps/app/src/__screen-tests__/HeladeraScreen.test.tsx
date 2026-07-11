import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockPantry, mockSuggest, mockGap, mockPush } = vi.hoisted(() => ({
  mockPantry: vi.fn(),
  mockSuggest: vi.fn(),
  mockGap: vi.fn(),
  mockPush: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: {
    pantry: { list: mockPantry },
    suggestions: { fromIngredients: mockSuggest },
    menu: { missingIngredients: mockGap },
  },
}))
vi.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: vi.fn() }) }))
vi.mock('../utils/weekMath', () => ({ getWeekStart: () => '2026-07-06' }))

import HeladeraScreen from '../../app/heladera/index'

const suggestion = (over: object) => ({
  id: 'r1',
  title: 'Guiso',
  matchedCount: 2,
  totalCount: 2,
  matchFraction: 1,
  missingIngredients: [],
  goalFit: null,
  nutrition: null,
  ...over,
})

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <HeladeraScreen />
    </QueryClientProvider>,
  )
}

describe('HeladeraScreen', () => {
  beforeEach(() => {
    mockPantry.mockReset().mockResolvedValue([])
    mockSuggest.mockReset().mockResolvedValue([])
    mockGap.mockReset().mockResolvedValue({ missing: [], meals: [] })
    mockPush.mockReset()
  })

  it('shows the zero-setup empty state before any ingredient is added', async () => {
    wrap()
    expect(await screen.findByText(/Escribí lo que tenés en casa/)).toBeInTheDocument()
  })

  it('adds an ingredient and shows cookable + almost sections with macro strip and goal badge', async () => {
    mockSuggest.mockResolvedValue([
      suggestion({
        id: 'cook',
        title: 'Listo',
        goalFit: 'dentro',
        nutrition: { calories: 400, protein_g: 30, carbs_g: 20, fat_g: 10 },
      }),
      suggestion({ id: 'almost', title: 'Casi', missingIngredients: ['Crema'] }),
    ])
    wrap()
    fireEvent.change(await screen.findByTestId('heladera-input'), { target: { value: 'pollo' } })
    fireEvent.click(screen.getByTestId('heladera-add'))

    expect(await screen.findByTestId('heladera-cookable')).toBeInTheDocument()
    expect(screen.getByTestId('heladera-almost')).toBeInTheDocument()
    expect(screen.getByText(/400 kcal/)).toBeInTheDocument()
    expect(screen.getByTestId('heladera-goalfit-cook')).toBeInTheDocument()
    expect(screen.getByText('falta: Crema')).toBeInTheDocument()

    // Tapping a card opens the recipe.
    fireEvent.click(screen.getByTestId('heladera-recipe-cook'))
    expect(mockPush).toHaveBeenCalledWith('/recipe/cook')
  })

  it('offers pantry chips and lets you remove a picked ingredient', async () => {
    mockPantry.mockResolvedValue([
      { id: 'p1', name: 'Arroz', inStock: true, quantity: null, unit: null, expiryDate: null },
    ])
    wrap()
    fireEvent.click(await screen.findByTestId('heladera-pantry-chip-p1'))
    // Chip becomes a "have" chip; tapping it removes it.
    const chip = await screen.findByTestId('heladera-have-arroz')
    fireEvent.click(chip)
    await waitFor(() => expect(screen.queryByTestId('heladera-have-arroz')).not.toBeInTheDocument())
  })

  it('shows the weekly gap and navigates to the shopping list', async () => {
    mockGap.mockResolvedValue({
      missing: [{ ingredient: 'Pollo', key: 'pollo' }],
      meals: [
        {
          date: '2026-07-06',
          slot: 'Cena',
          recipeId: 'a',
          recipeName: 'Ok',
          cookable: true,
          missingIngredients: [],
        },
        {
          date: '2026-07-07',
          slot: 'Cena',
          recipeId: 'b',
          recipeName: 'Falta',
          cookable: false,
          missingIngredients: ['Pollo'],
        },
      ],
    })
    wrap()
    fireEvent.click(await screen.findByTestId('heladera-tab-semana'))
    expect(await screen.findByText('Cocinable')).toBeInTheDocument()
    expect(screen.getByText('Incompleta')).toBeInTheDocument()
    expect(screen.getByText('falta: Pollo')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('heladera-add-to-list'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/menu/shopping-list',
      params: { weekStart: '2026-07-06' },
    })
  })

  it('explains the feature when the week has no planned meals', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('heladera-tab-semana'))
    expect(await screen.findByText(/Planificá tu semana/)).toBeInTheDocument()
  })
})
