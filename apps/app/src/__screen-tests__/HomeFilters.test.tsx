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

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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
