import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Recipe } from '@recetario/shared'

const { mockList, mockSearch, mockAdd, mockBack, mockNotify } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockSearch: vi.fn(),
  mockAdd: vi.fn().mockResolvedValue({}),
  mockBack: vi.fn(),
  mockNotify: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: { recipes: { list: mockList, search: mockSearch }, menu: { add: mockAdd } },
}))
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), back: mockBack, replace: vi.fn() }),
  useLocalSearchParams: () => ({ date: '2026-07-07', slot: 'Cena', weekStart: '2026-07-06' }),
}))
vi.mock('../utils/platformAlert', () => ({ notify: mockNotify }))
vi.mock('../components/AllergenBadge', () => ({ AllergenBadge: () => null }))

import PickRecipeScreen from '../../app/menu/pick'

const recipe = (over: Partial<Recipe>): Recipe =>
  ({
    id: '550e8400-e29b-41d4-a716-446655440001',
    title: 'Milanesas',
    servings: 4,
    category: 'Cena',
    tags: [],
    ingredients: [],
    steps: [],
    ...over,
  }) as Recipe

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PickRecipeScreen />
    </QueryClientProvider>,
  )
}

describe('PickRecipeScreen', () => {
  beforeEach(() => vi.clearAllMocks())

  it('names the slot and day it is picking for', async () => {
    mockList.mockResolvedValue([])
    wrap()
    expect(await screen.findByTestId('pick-header-slot-date')).toHaveTextContent(/^Cena · /)
    expect(await screen.findByText('No hay recetas aún')).toBeInTheDocument()
  })

  it('adds the tapped recipe with the chosen servings and goes back', async () => {
    const r = recipe({})
    mockList.mockResolvedValue([r])
    wrap()
    const card = await screen.findByTestId(`pick-recipe-${r.id}`)
    fireEvent.click(screen.getByText('+')) // 2 → 3
    fireEvent.click(card)
    await waitFor(() =>
      expect(mockAdd.mock.calls[0]?.[0]).toEqual({
        date: '2026-07-07',
        slot: 'Cena',
        recipeId: r.id,
        servings: 3,
      }),
    )
    await waitFor(() => expect(mockBack).toHaveBeenCalled())
  })

  it('searches by text and shows Sin resultados when nothing matches', async () => {
    mockList.mockResolvedValue([recipe({})])
    mockSearch.mockResolvedValue([])
    wrap()
    await screen.findByText('Milanesas')
    fireEvent.change(screen.getByPlaceholderText('Buscar receta...'), {
      target: { value: 'zzz' },
    })
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument()
    expect(mockSearch).toHaveBeenCalledWith({ q: 'zzz' })
  })

  it('filters by time and difficulty chips', async () => {
    mockList.mockResolvedValue([
      recipe({ id: 'a', title: 'Rápida', totalTimeMin: 15, difficulty: 'fácil' }),
      recipe({ id: 'b', title: 'Lenta', totalTimeMin: 120, difficulty: 'difícil' }),
    ])
    wrap()
    await screen.findByText('Lenta')
    fireEvent.click(screen.getByTestId('pick-filter-time-20'))
    await waitFor(() => expect(screen.queryByText('Lenta')).toBeNull())
    expect(screen.getByText('Rápida')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('pick-filter-time-20'))
    fireEvent.click(screen.getByTestId('pick-filter-difficulty-difícil'))
    await waitFor(() => expect(screen.queryByText('Rápida')).toBeNull())
  })

  it('notifies when adding fails', async () => {
    const r = recipe({})
    mockList.mockResolvedValue([r])
    mockAdd.mockRejectedValueOnce(new Error('boom'))
    wrap()
    fireEvent.click(await screen.findByTestId(`pick-recipe-${r.id}`))
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('Error', 'No se pudo agregar la receta al menú.'),
    )
    expect(mockBack).not.toHaveBeenCalled()
  })
})
