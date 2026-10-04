import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEFAULT_NUTRITION_TARGETS } from '@recetario/shared'

const m = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  signOut: vi.fn(async () => undefined),
  confirm: vi.fn(async () => true),
  refreshAfter: vi.fn(async () => []),
}))
vi.mock('../utils/menuCache', () => ({ refreshAfter: m.refreshAfter }))

vi.mock('../api/client', () => ({
  api: {
    auth: {
      me: vi.fn().mockResolvedValue({ id: 'u1', email: 'a@b.c', displayName: 'Ana' }),
      getProfile: m.getProfile,
      updateProfile: m.updateProfile,
      updateMe: vi.fn(),
    },
  },
}))
vi.mock('../providers/AuthProvider', () => ({
  useAuth: () => ({ token: 't', userId: 'u1', isLoading: false, signOut: m.signOut }),
}))
vi.mock('../utils/platformAlert', () => ({ confirmAsync: m.confirm, notify: vi.fn() }))

import ProfileScreen from '../../app/profile/index'

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ProfileScreen />
    </QueryClientProvider>,
  )
}

const baseProfile = {
  preferredServings: 2,
  dietaryRestrictions: [],
  allergens: [],
  goals: [],
  timezone: null,
}

describe('ProfileScreen targets and session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.updateProfile.mockResolvedValue({})
    m.confirm.mockResolvedValue(true)
  })

  it('unset daily targets show the defaults and a step starts from them', async () => {
    m.getProfile.mockResolvedValue({ ...baseProfile, nutritionTargets: null })
    wrap()
    expect(
      await screen.findByText(String(DEFAULT_NUTRITION_TARGETS.daily_calories)),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('target-daily_calories-plus'))
    await waitFor(() =>
      expect(m.updateProfile.mock.calls[0]?.[0]).toEqual({
        nutritionTargets: { ...DEFAULT_NUTRITION_TARGETS, daily_calories: 2100 },
      }),
    )
  })

  // 2026-10-02 review: a new goal only refreshed the profile, so the planner's
  // per-day summary kept the old target for up to 30s.
  it("changing a goal refreshes what's measured against it; a diet chip doesn't", async () => {
    m.getProfile.mockResolvedValue({ ...baseProfile, nutritionTargets: null })
    wrap()
    fireEvent.click(await screen.findByTestId('target-daily_calories-plus'))
    await waitFor(() => expect(m.refreshAfter).toHaveBeenCalledWith(expect.anything(), 'goals'))
    m.refreshAfter.mockClear()
    m.updateProfile.mockClear()
    fireEvent.click(screen.getByTestId('profile-diet-chip-vegano'))
    await waitFor(() => expect(m.updateProfile).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(m.refreshAfter).not.toHaveBeenCalled()
  })

  it('a per-meal goal is stored under its menu slot', async () => {
    m.getProfile.mockResolvedValue({
      ...baseProfile,
      nutritionTargets: { ...DEFAULT_NUTRITION_TARGETS, per_meal: { Cena: { calories: 600 } } },
    })
    wrap()
    fireEvent.click(await screen.findByTestId('meal-target-Cena-plus'))
    await waitFor(() =>
      expect(m.updateProfile.mock.calls[0]?.[0]).toMatchObject({
        nutritionTargets: { per_meal: { Cena: { calories: 650 } } },
      }),
    )
  })

  // Auditar 2026-09-30 / 2026-10-03: the daily stepper sent only the four
  // daily fields, and the API replaces the whole object, so per_meal was lost.
  it('changing a daily target keeps the per-meal goals', async () => {
    m.getProfile.mockResolvedValue({
      ...baseProfile,
      nutritionTargets: { ...DEFAULT_NUTRITION_TARGETS, per_meal: { Cena: { calories: 600 } } },
    })
    wrap()
    fireEvent.click(await screen.findByTestId('target-daily_calories-plus'))
    await waitFor(() =>
      expect(m.updateProfile.mock.calls[0]?.[0]).toEqual({
        nutritionTargets: {
          ...DEFAULT_NUTRITION_TARGETS,
          daily_calories: 2100,
          per_meal: { Cena: { calories: 600 } },
        },
      }),
    )
  })

  it('daily targets never go below zero', async () => {
    m.getProfile.mockResolvedValue({
      ...baseProfile,
      nutritionTargets: { ...DEFAULT_NUTRITION_TARGETS, daily_fat_g: 0 },
    })
    wrap()
    fireEvent.click(await screen.findByTestId('target-daily_fat_g-minus'))
    await waitFor(() =>
      expect(m.updateProfile.mock.calls[0]?.[0]).toMatchObject({
        nutritionTargets: { daily_fat_g: 0 },
      }),
    )
  })

  it('signing out asks first', async () => {
    m.getProfile.mockResolvedValue({ ...baseProfile, nutritionTargets: null })
    wrap()
    m.confirm.mockResolvedValueOnce(false)
    fireEvent.click(await screen.findByTestId('profile-signout'))
    await waitFor(() => expect(m.confirm).toHaveBeenCalledWith('Cerrar sesión', '¿Estás seguro?'))
    expect(m.signOut).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('profile-signout'))
    await waitFor(() => expect(m.signOut).toHaveBeenCalled())
  })

  it('diet chips read as words, not slugs', async () => {
    m.getProfile.mockResolvedValue(baseProfile)
    wrap()
    expect(await screen.findByTestId('profile-diet-chip-sin-gluten')).toHaveTextContent(
      /^Sin gluten$/,
    )
    expect(screen.getByTestId('profile-diet-chip-sin-lactosa')).toHaveTextContent(/^Sin lactosa$/)
    expect(screen.getByTestId('profile-diet-chip-vegano')).toHaveTextContent(/^Vegano$/)
    expect(screen.queryByText('sin-gluten')).toBeNull()
  })
})

// 2026-10-02 review: a failed load showed the default targets, and a tap on a
// stepper then overwrote the real ones with them
describe('ProfileScreen load error', () => {
  it('shows an error with no steppers, so nothing can overwrite the saved targets', async () => {
    m.getProfile
      .mockReset()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({
        ...baseProfile,
        nutritionTargets: null,
      })
    wrap()
    expect(await screen.findByText('No se pudo cargar tu perfil.')).toBeInTheDocument()
    expect(screen.queryByTestId('target-daily_calories-plus')).toBeNull()
    fireEvent.click(screen.getByTestId('error-retry'))
    expect(await screen.findByTestId('target-daily_calories-plus')).toBeInTheDocument()
    expect(m.updateProfile).not.toHaveBeenCalled()
  })
})
