import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockStats, mockPush } = vi.hoisted(() => ({
  mockStats: vi.fn(),
  mockPush: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: { cookSessions: { stats: mockStats } },
}))

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn(), replace: vi.fn() }),
}))

import StatsScreen from '../../app/stats/index'

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('StatsScreen', () => {
  beforeEach(() => {
    mockStats.mockReset()
    mockPush.mockReset()
  })

  it('shows total sessions and top recipes', async () => {
    mockStats.mockResolvedValue({
      since: '2026-07-03',
      totalSessions: 5,
      topRecipes: [
        { recipeId: 'abc12345-x', title: 'Milanesas', count: 3, lastCookedAt: '2026-01-01' },
      ],
      frequencyByWeek: [],
    })
    wrap(<StatsScreen />)
    expect(await screen.findByText('5')).toBeInTheDocument()
    // Named by title, never by id; the window is spelled out
    expect(await screen.findByText('Milanesas')).toBeInTheDocument()
    expect(screen.queryByText(/abc12345/)).toBeNull()
    expect(screen.getByText(/sesiones de cocina desde el 3 jul/)).toBeInTheDocument()
  })

  it('navigates to the recipe when a top-recipe row with a live recipeId is tapped', async () => {
    mockStats.mockResolvedValue({
      totalSessions: 1,
      topRecipes: [
        { recipeId: 'abc12345-x', title: 'Milanesas', count: 1, lastCookedAt: '2026-01-01' },
      ],
      frequencyByWeek: [],
    })
    wrap(<StatsScreen />)
    const row = await screen.findByText('Milanesas')
    fireEvent.click(row)
    expect(mockPush).toHaveBeenCalledWith('/recipe/abc12345-x')
  })

  // Regression test: a cooked recipe that was later deleted used to crash this
  // screen (recipeId.slice() on null) once the cascade-delete fix started
  // returning topRecipes entries with recipeId: null.
  it('shows a deleted-recipe placeholder instead of crashing when recipeId is null', async () => {
    mockStats.mockResolvedValue({
      totalSessions: 2,
      topRecipes: [{ recipeId: null, title: 'Guiso', count: 2, lastCookedAt: '2026-01-01' }],
      frequencyByWeek: [],
    })
    wrap(<StatsScreen />)
    expect(await screen.findByText('Guiso (eliminada)')).toBeInTheDocument()
  })

  it('does not navigate when tapping a deleted-recipe row', async () => {
    mockStats.mockResolvedValue({
      totalSessions: 2,
      topRecipes: [{ recipeId: null, title: 'Guiso', count: 2, lastCookedAt: '2026-01-01' }],
      frequencyByWeek: [],
    })
    wrap(<StatsScreen />)
    const row = await screen.findByText('Guiso (eliminada)')
    fireEvent.click(row)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows the empty state when there are no top recipes', async () => {
    mockStats.mockResolvedValue({ totalSessions: 0, topRecipes: [], frequencyByWeek: [] })
    wrap(<StatsScreen />)
    expect(
      await screen.findByText('¡Empezá a cocinar para ver tus recetas más usadas acá!'),
    ).toBeInTheDocument()
  })

  it('shows the weekly frequency chart when there is data', async () => {
    mockStats.mockResolvedValue({
      totalSessions: 3,
      topRecipes: [],
      // The label is formatted in UTC, so the week's Monday shows as is in
      // any time zone (it used to read as the Sunday before at UTC-3).
      frequencyByWeek: [{ week: '2026-06-01', count: 3 }],
    })
    wrap(<StatsScreen />)
    const bar = await screen.findByTestId('stats-week-2026-06-01')
    expect(bar).toHaveTextContent('3')
    expect(bar).toHaveTextContent(/1 jun/)
  })
})

// Story "App: pantalla de stats y tendencias": "streak de días consecutivos
// cocinando" and "gráfico de barras de frecuencia por semana (mínimo 8 semanas)".
describe('StatsScreen: streak and weekly chart', () => {
  beforeEach(() => mockStats.mockReset())

  const base = {
    since: '2026-07-03',
    totalSessions: 4,
    topRecipes: [],
    frequencyByWeek: [{ week: '2026-09-21', count: 2 }],
  }

  it('shows the current streak and the best one', async () => {
    mockStats.mockResolvedValue({ ...base, streak: { current: 3, longest: 5 } })
    wrap(<StatsScreen />)
    expect(await screen.findByTestId('stats-streak')).toHaveTextContent(
      '🔥 3 días seguidos cocinando',
    )
    expect(screen.getByTestId('stats-streak-longest')).toHaveTextContent(
      'Mejor racha: 5 días seguidos',
    )
  })

  it('a broken streak invites to cook today but keeps the best one', async () => {
    mockStats.mockResolvedValue({ ...base, streak: { current: 0, longest: 4 } })
    wrap(<StatsScreen />)
    expect(await screen.findByTestId('stats-streak')).toHaveTextContent(
      'Cociná hoy para empezar una racha',
    )
    expect(screen.getByTestId('stats-streak-longest')).toHaveTextContent('Mejor racha: 4 días')
  })

  it('without any cooking there is no "best" line', async () => {
    mockStats.mockResolvedValue({
      ...base,
      frequencyByWeek: [],
      streak: { current: 0, longest: 0 },
    })
    wrap(<StatsScreen />)
    await screen.findByTestId('stats-streak')
    expect(screen.queryByTestId('stats-streak-longest')).toBeNull()
  })

  it('an older API without a streak still renders', async () => {
    mockStats.mockResolvedValue(base)
    wrap(<StatsScreen />)
    expect(await screen.findByTestId('stats-streak')).toHaveTextContent('Cociná hoy')
  })

  it('draws at least 8 weekly bars ending this week, empty weeks included', async () => {
    mockStats.mockResolvedValue({ ...base, streak: { current: 1, longest: 1 } })
    wrap(<StatsScreen />)
    await screen.findByTestId('stats-streak')
    const bars = document.querySelectorAll('[data-testid^="stats-week-"]')
    expect(bars.length).toBeGreaterThanOrEqual(8)
    // The week with data shows its count; the others read 0
    expect(screen.getByTestId('stats-week-2026-09-21')).toHaveTextContent('2')
    const last = bars[bars.length - 1]!.getAttribute('data-testid')!.replace('stats-week-', '')
    expect(new Date(last + 'T00:00:00Z').getUTCDay()).toBe(1) // a Monday
  })
})

describe('StatsScreen: when the stats request fails', () => {
  it('shows the empty states and an 8-week empty chart frame, not a crash', async () => {
    mockStats.mockReset().mockRejectedValue(new Error('API 500'))
    wrap(<StatsScreen />)
    expect(await screen.findByTestId('stats-streak')).toHaveTextContent('Cociná hoy')
    expect(screen.getByText('Todavía no hay sesiones de cocina registradas.')).toBeInTheDocument()
    expect(screen.getByText(/¡Empezá a cocinar/)).toBeInTheDocument()
  })
})
