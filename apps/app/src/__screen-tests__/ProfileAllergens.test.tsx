import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockGetProfile, mockUpdateProfile } = vi.hoisted(() => ({
  mockGetProfile: vi.fn(),
  mockUpdateProfile: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: {
    auth: {
      me: vi.fn().mockResolvedValue({ id: 'u1', email: 'a@b.c', displayName: 'Ana' }),
      getProfile: mockGetProfile,
      updateProfile: mockUpdateProfile,
      updateMe: vi.fn(),
    },
  },
}))
vi.mock('../providers/AuthProvider', () => ({
  useAuth: () => ({ token: 't', userId: 'u1', isLoading: false, signOut: vi.fn() }),
}))

import ProfileScreen from '../../app/profile/index'

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ProfileScreen />
    </QueryClientProvider>,
  )
}

describe('Profile allergen picker', () => {
  beforeEach(() => {
    mockUpdateProfile.mockReset().mockResolvedValue({})
    mockGetProfile.mockReset().mockResolvedValue({
      preferredServings: 2,
      dietaryRestrictions: [],
      allergens: ['leche', 'kiwi'],
      goals: [],
      timezone: null,
      nutritionTargets: null,
    })
  })

  it('shows all 14 allergens with Spanish labels and marks the saved ones', async () => {
    wrap()
    expect(await screen.findByTestId('allergen-chip-frutos_secos')).toHaveTextContent(
      'Frutos secos',
    )
    expect(screen.getByTestId('allergen-chip-gluten')).toHaveTextContent('Gluten (TACC)')
    expect(screen.getAllByTestId(/^allergen-chip-/)).toHaveLength(14)
  })

  it('adds an allergen, sending only enum keys', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('allergen-chip-mani'))
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalled())
    expect(mockUpdateProfile.mock.calls[0]?.[0]).toEqual({ allergens: ['leche', 'mani'] })
  })

  it('removes a saved allergen', async () => {
    wrap()
    await screen.findByTestId('allergen-chip-leche')
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalled())
    fireEvent.click(screen.getByTestId('allergen-chip-leche'))
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalled())
    expect(mockUpdateProfile.mock.calls[0]?.[0]).toEqual({ allergens: [] })
  })
})
