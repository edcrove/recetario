import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Role-aware rendering (sharing epic story 6): the Editar affordance only
// renders for the recipe's owner — housemates get read-only sharing.

const recipeOf = (ownerId: string) => ({
  id: 'test-id',
  title: 'Guiso Compartido',
  servings: 4,
  category: 'Cena',
  tags: [],
  images: [],
  originalLanguage: 'es',
  translations: [],
  ingredients: [{ name: 'Lentejas', quantity: 500, unit: 'g' }],
  steps: [{ text: 'Cocinar' }],
  ownerId,
})

const mockGet = vi.fn()

vi.mock('../api/client', () => ({
  api: {
    recipes: { get: (...args: unknown[]) => mockGet(...args) },
    cookSessions: { list: vi.fn().mockResolvedValue([]) },
    taxonomy: { relations: vi.fn().mockResolvedValue([]) },
    auth: { getProfile: vi.fn().mockResolvedValue(null) },
  },
}))

vi.mock('../providers/AuthProvider', () => ({
  useAuth: () => ({
    token: 't',
    userId: 'me-123',
    isLoading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
  getStoredToken: vi.fn().mockResolvedValue('t'),
}))

import RecipeDetailScreen from '../../app/recipe/[id]'

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('RecipeDetailScreen role-aware rendering', () => {
  it('shows Editar on the user’s own recipe', async () => {
    mockGet.mockResolvedValue(recipeOf('me-123'))
    wrap(<RecipeDetailScreen />)
    expect(await screen.findByText('Guiso Compartido')).toBeInTheDocument()
    expect(screen.getByText('Editar')).toBeInTheDocument()
  })

  it("hides Editar on a housemate's recipe", async () => {
    mockGet.mockResolvedValue(recipeOf('housemate-456'))
    wrap(<RecipeDetailScreen />)
    expect(await screen.findByText('Guiso Compartido')).toBeInTheDocument()
    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
  })
})
