import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockList, mockSearch, mockFoodTypes } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockSearch: vi.fn(),
  mockFoodTypes: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: {
    recipes: { list: mockList, search: mockSearch },
    taxonomy: { foodTypes: mockFoodTypes },
  },
}))
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }))
vi.mock('../providers/AuthProvider', () => ({ useAuth: () => ({ token: 'tok' }) }))
vi.mock('../components/UserMenu', () => ({ UserMenu: () => null }))

import HomeScreen from '../../app/index'

const recipe = (over: object) => ({
  id: 'x',
  title: 'R',
  category: 'Cena',
  servings: 2,
  tags: [],
  images: [],
  ingredients: [],
  steps: [],
  ...over,
})

let client: QueryClient
function wrap() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <HomeScreen />
    </QueryClientProvider>,
  )
}

describe('HomeScreen time/difficulty filters', () => {
  beforeEach(() => {
    mockFoodTypes.mockReset().mockResolvedValue([])
    mockSearch.mockReset().mockResolvedValue([])
    mockList
      .mockReset()
      .mockResolvedValue([
        recipe({ id: 'fast', title: 'Rápida', totalTimeMin: 15, difficulty: 'fácil' }),
        recipe({ id: 'slow', title: 'Lenta', totalTimeMin: 90, difficulty: 'difícil' }),
      ])
  })

  it('shows the compact "⏱ min · dificultad" line on cards', async () => {
    wrap()
    expect(await screen.findByTestId('recipe-meta-fast')).toHaveTextContent('⏱ 15 min · fácil')
  })

  it('filters the list by a max-time chip', async () => {
    wrap()
    await screen.findByTestId('recipe-card-fast')
    expect(screen.getByTestId('recipe-card-slow')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('filter-time-20'))

    await waitFor(() => expect(screen.queryByTestId('recipe-card-slow')).not.toBeInTheDocument())
    expect(screen.getByTestId('recipe-card-fast')).toBeInTheDocument()
  })

  it('filters the list by a difficulty chip and clears when tapped again', async () => {
    wrap()
    await screen.findByTestId('recipe-card-fast')

    fireEvent.click(screen.getByTestId('filter-difficulty-difícil'))
    await waitFor(() => expect(screen.queryByTestId('recipe-card-fast')).not.toBeInTheDocument())
    expect(screen.getByTestId('recipe-card-slow')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('filter-difficulty-difícil'))
    await waitFor(() => expect(screen.getByTestId('recipe-card-fast')).toBeInTheDocument())
  })
})

// Story "App: dietary tags picker in recipe form + allergen warning": "Home
// screen: dietary filter in search combines with food type filter".
describe('HomeScreen diet filter', () => {
  beforeEach(() => {
    mockFoodTypes.mockReset().mockResolvedValue([{ id: 'ft-postre', name: 'Postres' }])
    mockList.mockReset().mockResolvedValue([recipe({ id: 'all', title: 'Todas' })])
    mockSearch.mockReset().mockResolvedValue([recipe({ id: 'hit', title: 'Helado vegano' })])
  })

  it('offers every diet as a chip, none selected', async () => {
    wrap()
    for (const [tag, label] of [
      ['vegano', 'Vegano'],
      ['vegetariano', 'Vegetariano'],
      ['sin-gluten', 'Sin gluten'],
      ['sin-lactosa', 'Sin lactosa'],
      ['keto', 'Keto'],
      ['paleo', 'Paleo'],
    ]) {
      const chip = await screen.findByTestId(`home-diet-chip-${tag}`)
      expect(chip).toHaveTextContent(label!)
      expect(chip).toHaveAttribute('aria-selected', 'false')
    }
  })

  it('a diet chip searches by diet and marks itself selected', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('home-diet-chip-vegano'))
    await waitFor(() => expect(mockSearch).toHaveBeenLastCalledWith({ dietary: 'vegano' }))
    expect(await screen.findByTestId('recipe-card-hit')).toBeInTheDocument()
    expect(screen.getByTestId('home-diet-chip-vegano')).toHaveAttribute('aria-selected', 'true')
  })

  it('diet and food type combine in one search', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('home-type-chip-ft-postre'))
    fireEvent.click(screen.getByTestId('home-diet-chip-sin-gluten'))
    await waitFor(() =>
      expect(mockSearch).toHaveBeenLastCalledWith({
        foodTypeId: 'ft-postre',
        dietary: 'sin-gluten',
      }),
    )
  })

  it('switching diets replaces the previous one; tapping again clears it', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('home-diet-chip-vegano'))
    fireEvent.click(screen.getByTestId('home-diet-chip-keto'))
    await waitFor(() => expect(mockSearch).toHaveBeenLastCalledWith({ dietary: 'keto' }))
    expect(screen.getByTestId('home-diet-chip-vegano')).toHaveAttribute('aria-selected', 'false')
    fireEvent.click(screen.getByTestId('home-diet-chip-keto'))
    expect(await screen.findByTestId('recipe-card-all')).toBeInTheDocument()
  })

  it('"Todas" clears the diet too', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('home-diet-chip-vegano'))
    await screen.findByTestId('recipe-card-hit')
    fireEvent.click(screen.getByTestId('home-type-chip-all'))
    expect(await screen.findByTestId('recipe-card-all')).toBeInTheDocument()
    expect(screen.getByTestId('home-diet-chip-vegano')).toHaveAttribute('aria-selected', 'false')
  })

  it('no match with a diet selected reads "Sin resultados", not the first-run state', async () => {
    mockSearch.mockResolvedValue([])
    wrap()
    fireEvent.click(await screen.findByTestId('home-diet-chip-paleo'))
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument()
  })
})

describe('HomeScreen list freshness and empty states', () => {
  beforeEach(() => {
    mockFoodTypes.mockReset().mockResolvedValue([{ id: 'ft-postre', name: 'Postres' }])
    mockSearch.mockReset().mockResolvedValue([])
    mockList
      .mockReset()
      .mockResolvedValue([
        recipe({ id: 'slow', title: 'Lenta', totalTimeMin: 90, difficulty: 'difícil' }),
      ])
  })

  it('loads the recipes and refreshes when another screen invalidates "recipes"', async () => {
    wrap()
    await screen.findByTestId('recipe-card-slow')
    expect(mockList).toHaveBeenCalledWith({ limit: 100, offset: 0 })
    // e.g. after creating or deleting a recipe elsewhere
    await client.invalidateQueries({ queryKey: ['recipes'] })
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2))
  })

  // 2026-10-02 review: home asked for one page of 50, so from the 51st recipe
  // on the oldest never showed, and the filters only looked at those 50.
  it('shows recipes past the first page, and the time filter finds them', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) =>
      recipe({ id: `p${i}`, title: `Receta ${i}`, totalTimeMin: 90 }),
    )
    mockList
      .mockReset()
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce([recipe({ id: 'old', title: 'Vieja y rápida', totalTimeMin: 10 })])
    wrap()
    expect(await screen.findByTestId('recipe-card-old')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('filter-time-20'))
    await waitFor(() => expect(screen.queryByTestId('recipe-card-p0')).toBeNull())
    expect(screen.getByTestId('recipe-card-old')).toBeInTheDocument()
    expect(mockList.mock.calls.map((c) => c[0])).toEqual([
      { limit: 100, offset: 0 },
      { limit: 100, offset: 100 },
    ])
  })

  it('a time filter that matches nothing reads "Sin resultados"', async () => {
    wrap()
    await screen.findByTestId('recipe-card-slow')
    fireEvent.click(screen.getByTestId('filter-time-20'))
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument()
  })

  it('a difficulty filter that matches nothing reads "Sin resultados"', async () => {
    wrap()
    await screen.findByTestId('recipe-card-slow')
    fireEvent.click(screen.getByTestId('filter-difficulty-fácil'))
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument()
  })

  it('a food type that matches nothing reads "Sin resultados"', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('home-type-chip-ft-postre'))
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument()
  })

  it('with no filter and no recipes it is the first-run state, not "Sin resultados"', async () => {
    mockList.mockResolvedValue([])
    wrap()
    expect(await screen.findByTestId('welcome-card')).toBeInTheDocument()
    expect(screen.queryByText('Sin resultados')).toBeNull()
  })
})
