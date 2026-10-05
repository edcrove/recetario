import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Recipe } from '@recetario/shared'

const { mockGetProfile, mockHouseholds } = vi.hoisted(() => ({
  mockGetProfile: vi.fn(),
  mockHouseholds: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: { auth: { getProfile: mockGetProfile }, households: { mine: mockHouseholds } },
}))
vi.mock('../providers/AuthProvider', () => ({ useAuth: () => ({ token: 't', userId: 'me' }) }))

import { AllergenWarning } from '../components/AllergenWarning'

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const recipe = (...names: string[]) =>
  ({
    ingredients: names.map((name) => ({ name, quantity: 1, unit: null })),
    dietaryTags: [],
  }) as unknown as Recipe

// Auditar 2026-10-03 (Nutrition): detection is by name, so it must say so.
describe('AllergenWarning', () => {
  beforeEach(() => {
    mockGetProfile.mockReset()
    mockHouseholds.mockReset().mockResolvedValue([])
  })

  it('warns about a hidden source and adds the label caveat', async () => {
    mockGetProfile.mockResolvedValue({ allergens: ['gluten'], dietaryRestrictions: [] })
    wrap(<AllergenWarning recipe={recipe('Arroz', 'Salsa de soja')} />)
    expect(await screen.findByTestId('allergen-warning')).toHaveTextContent('Gluten (TACC)')
    expect(screen.getByTestId('allergen-disclaimer')).toHaveTextContent('verificá la etiqueta')
  })

  it('with allergies and no match, still says it is only a name check', async () => {
    mockGetProfile.mockResolvedValue({ allergens: ['mani'], dietaryRestrictions: [] })
    wrap(<AllergenWarning recipe={recipe('Arroz')} />)
    expect(await screen.findByTestId('allergen-disclaimer')).toHaveTextContent(
      'No encontramos tus alérgenos',
    )
    expect(screen.queryByTestId('allergen-warning')).toBeNull()
  })

  it('a diet conflict alone shows no allergen caveat', async () => {
    mockGetProfile.mockResolvedValue({ allergens: [], dietaryRestrictions: ['vegano'] })
    wrap(<AllergenWarning recipe={recipe('Manteca')} />)
    expect(await screen.findByTestId('allergen-warning')).toHaveTextContent('No cumple')
    expect(screen.queryByTestId('allergen-disclaimer')).toBeNull()
  })

  it('nothing to say without allergies or diets', async () => {
    mockGetProfile.mockResolvedValue({ allergens: [], dietaryRestrictions: [] })
    const { container } = wrap(<AllergenWarning recipe={recipe('Arroz')} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(container).toBeEmptyDOMElement()
  })

  // Story (Auditar 2026-10-03): a kid's allergy, set by the other parent,
  // warns me too and says whom it is for.
  it("warns about a household diner's allergy and names them", async () => {
    mockGetProfile.mockResolvedValue({ allergens: ['leche'], dietaryRestrictions: [] })
    mockHouseholds.mockResolvedValue([
      {
        members: [{ userId: 'me', acceptedAt: '2026-10-01' }],
        diners: [
          {
            id: 'd1',
            householdId: 'h1',
            name: 'Sofi',
            allergens: ['mani', 'leche'],
            dietaryRestrictions: ['vegano'],
          },
        ],
      },
    ])
    wrap(<AllergenWarning recipe={recipe('Maní tostado', 'Manteca')} />)
    const warning = await screen.findByTestId('allergen-warning')
    await waitFor(() => expect(warning).toHaveTextContent('Maní (Sofi)'))
    expect(warning).toHaveTextContent('Leche y lácteos (vos, Sofi)')
    expect(warning).toHaveTextContent('Vegano (Sofi)')
    expect(screen.getByTestId('allergen-disclaimer')).toBeInTheDocument()
  })
})
