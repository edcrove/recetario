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
      // Mid-month date so a +/- one day shift from timezone conversion
      // (new Date('2026-06-15') is parsed as UTC midnight) never crosses
      // into a different month — a date near month-end previously made
      // this assertion timezone-dependent (passed locally at UTC-3, failed
      // in CI's UTC runner).
      frequencyByWeek: [{ week: '2026-06-15', count: 3 }],
    })
    wrap(<StatsScreen />)
    expect(await screen.findByText(/jun/)).toBeInTheDocument()
  })
})
