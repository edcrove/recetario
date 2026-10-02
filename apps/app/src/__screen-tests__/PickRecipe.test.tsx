import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Recipe } from '@recetario/shared'

const { mockList, mockSearch, mockAdd, mockBack, mockNotify, mockProfile, mockDay, params } =
  vi.hoisted(() => ({
    params: {
      current: { date: '2026-07-07', slot: 'Cena', weekStart: '2026-07-06' } as Record<
        string,
        string
      >,
    },
    mockProfile: vi.fn(),
    mockDay: vi.fn(),
    mockList: vi.fn(),
    mockSearch: vi.fn(),
    mockAdd: vi.fn().mockResolvedValue({}),
    mockBack: vi.fn(),
    mockNotify: vi.fn(),
  }))

vi.mock('../api/client', () => ({
  api: {
    recipes: { list: mockList, search: mockSearch },
    menu: { add: mockAdd, dayNutrition: mockDay },
    auth: { getProfile: mockProfile },
  },
}))
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), back: mockBack, replace: vi.fn() }),
  useLocalSearchParams: () => params.current,
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

let client: QueryClient
function wrap() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PickRecipeScreen />
    </QueryClientProvider>,
  )
}

describe('PickRecipeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProfile.mockResolvedValue({ nutritionTargets: null })
  })

  it('names the slot and day it is picking for', async () => {
    mockList.mockResolvedValue([])
    wrap()
    expect(await screen.findByTestId('pick-header-slot-date')).toHaveTextContent(/^Cena · /)
    expect(await screen.findByText('No hay recetas aún')).toBeInTheDocument()
  })

  // 2026-10-02 review: the picker asked for one page of 50, so older recipes
  // could never be planned without searching for them.
  it('offers recipes past the first page', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => recipe({ id: `p${i}`, title: `R ${i}` }))
    const old = recipe({ id: 'old', title: 'La más vieja' })
    mockList.mockResolvedValueOnce(page1).mockResolvedValueOnce([old])
    wrap()
    expect(await screen.findByTestId('pick-recipe-old')).toBeInTheDocument()
    expect(mockList).toHaveBeenLastCalledWith({ limit: 100, offset: 100 })
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

// Story "goals in Perfil + day progress/delta in planner": "Pick screen with
// goals set: projected delta preview ('con esta receta el almuerzo queda en
// 780 / 700 kcal')". The slot here is Cena on 2026-07-07.
describe('PickRecipeScreen: goal preview', () => {
  const day = (cena: number, total: number) => ({
    date: '2026-07-07',
    totals: { calories: total, protein_g: 0, carbs_g: 0, fat_g: 0 },
    target: null,
    delta: null,
    byMeal: [
      {
        mealCategory: 'Almuerzo',
        totals: { calories: total - cena, protein_g: 0, carbs_g: 0, fat_g: 0 },
        target: null,
        calorieDelta: null,
      },
      {
        mealCategory: 'cena',
        totals: { calories: cena, protein_g: 0, carbs_g: 0, fat_g: 0 },
        target: null,
        calorieDelta: null,
      },
    ],
    partial: false,
    missingCount: 0,
  })
  const nutrition = (calories: number) => ({ calories, protein_g: 10, carbs_g: 10, fat_g: 10 })
  const goals = (perMeal?: Record<string, { calories: number }>) => ({
    nutritionTargets: {
      daily_calories: 2000,
      daily_protein_g: 0,
      daily_carbs_g: 0,
      daily_fat_g: 0,
      ...(perMeal && { per_meal: perMeal }),
    },
  })

  beforeEach(() => {
    vi.clearAllMocks()
    params.current = { date: '2026-07-07', slot: 'Cena', weekStart: '2026-07-06' }
  })

  it('with a dinner goal, each recipe shows where dinner lands (what is planned + the recipe)', async () => {
    mockProfile.mockResolvedValue(goals({ Cena: { calories: 700 } }))
    mockDay.mockResolvedValue(day(300, 1100))
    const light = recipe({ id: 'a1', title: 'Ensalada', nutrition: nutrition(350) })
    const heavy = recipe({ id: 'a2', title: 'Guiso', nutrition: nutrition(780) })
    mockList.mockResolvedValue([light, heavy])
    wrap()
    const a = await screen.findByTestId('pick-projection-a1')
    expect(a).toHaveTextContent('Con esta receta la cena queda en 650 / 700 kcal')
    expect(a).toHaveAttribute('data-status', 'ok')
    const b = screen.getByTestId('pick-projection-a2')
    expect(b).toHaveTextContent('Con esta receta la cena queda en 1080 / 700 kcal')
    expect(b).toHaveAttribute('data-status', 'over')
    expect(mockDay).toHaveBeenCalledWith('2026-07-07')
    // Same cache entry as the planner's day summary, so picking refreshes both
    expect(client.getQueryData(['day-nutrition', '2026-07-07'])).toEqual(day(300, 1100))
  })

  it('opened without a slot it previews the day against the daily goal', async () => {
    params.current = { date: '2026-07-07', weekStart: '2026-07-06' }
    mockProfile.mockResolvedValue(goals({ Cena: { calories: 700 } }))
    mockDay.mockResolvedValue(day(300, 1100))
    mockList.mockResolvedValue([recipe({ id: 'a1', nutrition: nutrition(400) })])
    wrap()
    expect(await screen.findByTestId('pick-projection-a1')).toHaveTextContent(
      'Con esta receta el día queda en 1500 / 2000 kcal',
    )
  })

  it('without a meal goal it projects the day against the daily goal', async () => {
    mockProfile.mockResolvedValue(goals())
    mockDay.mockResolvedValue(day(300, 1100))
    mockList.mockResolvedValue([recipe({ id: 'a1', nutrition: nutrition(500) })])
    wrap()
    const p = await screen.findByTestId('pick-projection-a1')
    expect(p).toHaveTextContent('Con esta receta el día queda en 1600 / 2000 kcal')
    expect(p).toHaveAttribute('data-status', 'under')
  })

  it('no preview while the day is still loading (unknown is not zero)', async () => {
    mockProfile.mockResolvedValue(goals({ Cena: { calories: 700 } }))
    mockDay.mockReturnValue(new Promise(() => {}))
    mockList.mockResolvedValue([recipe({ id: 'a1', nutrition: nutrition(400) })])
    wrap()
    await screen.findByTestId('pick-recipe-a1')
    await waitFor(() => expect(mockDay).toHaveBeenCalled())
    expect(screen.queryByTestId('pick-projection-a1')).toBeNull()
  })

  it('an empty day starts from zero', async () => {
    mockProfile.mockResolvedValue(goals({ Cena: { calories: 700 } }))
    mockDay.mockResolvedValue({ ...day(0, 0), byMeal: [] })
    mockList.mockResolvedValue([recipe({ id: 'a1', nutrition: nutrition(700) })])
    wrap()
    expect(await screen.findByTestId('pick-projection-a1')).toHaveTextContent(
      'Con esta receta la cena queda en 700 / 700 kcal',
    )
  })

  it('a recipe without nutrition shows no preview (never guessed)', async () => {
    mockProfile.mockResolvedValue(goals({ Cena: { calories: 700 } }))
    mockDay.mockResolvedValue(day(300, 1100))
    mockList.mockResolvedValue([
      recipe({ id: 'a1', nutrition: nutrition(400) }),
      recipe({ id: 'a2', title: 'Sin datos' }),
    ])
    wrap()
    await screen.findByTestId('pick-projection-a1')
    expect(screen.queryByTestId('pick-projection-a2')).toBeNull()
  })

  it('without goals there is no preview and the day is not even fetched', async () => {
    mockProfile.mockResolvedValue({ nutritionTargets: null })
    mockList.mockResolvedValue([recipe({ id: 'a1', nutrition: nutrition(400) })])
    wrap()
    await screen.findByTestId('pick-recipe-a1')
    await waitFor(() => expect(mockProfile).toHaveBeenCalled())
    expect(screen.queryByTestId('pick-projection-a1')).toBeNull()
    expect(mockDay).not.toHaveBeenCalled()
  })
})
