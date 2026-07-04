import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockGetProfile } = vi.hoisted(() => ({ mockGetProfile: vi.fn() }))

vi.mock('../api/client', () => ({
  api: { auth: { getProfile: mockGetProfile } },
}))

import { AllergenBadge } from '../components/AllergenBadge'

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const recipeWithMilk = {
  ingredients: [{ name: 'Leche', quantity: 1, unit: 'cup' as const }],
  dietaryTags: [],
}

describe('AllergenBadge', () => {
  beforeEach(() => mockGetProfile.mockReset())

  it('renders nothing when there is no conflict', async () => {
    mockGetProfile.mockResolvedValue({ allergens: [], dietaryRestrictions: [] })
    wrap(<AllergenBadge recipe={recipeWithMilk} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByTestId('allergen-badge')).not.toBeInTheDocument()
  })

  it('renders the badge when an allergen matches an ingredient', async () => {
    mockGetProfile.mockResolvedValue({ allergens: ['leche'], dietaryRestrictions: [] })
    wrap(<AllergenBadge recipe={recipeWithMilk} />)
    expect(await screen.findByTestId('allergen-badge')).toBeInTheDocument()
  })

  it('renders the badge when a dietary restriction is unmet', async () => {
    mockGetProfile.mockResolvedValue({ allergens: [], dietaryRestrictions: ['vegano'] })
    wrap(<AllergenBadge recipe={recipeWithMilk} />)
    expect(await screen.findByTestId('allergen-badge')).toBeInTheDocument()
  })
})
