import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }))

vi.mock('../api/client', () => ({
  api: { recipes: { get: mockGet }, cookSessions: { create: vi.fn() } },
}))
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'r1' }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: vi.fn().mockResolvedValue(undefined),
  deactivateKeepAwake: vi.fn(),
}))
vi.mock('../utils/cookEffects', () => ({
  onStepTimerComplete: vi.fn(),
  startSpeech: vi.fn().mockReturnValue(false),
  stopSpeech: vi.fn(),
}))

import CookModeScreen from '../../app/recipe/[id]/cook'

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CookModeScreen />
    </QueryClientProvider>,
  )
}

describe('CookModeScreen step timer (tap-to-start)', () => {
  beforeEach(() => {
    mockGet.mockReset().mockResolvedValue({
      id: 'r1',
      title: 'Guiso',
      servings: 2,
      category: 'Cena',
      tags: [],
      images: [],
      ingredients: [{ name: 'Agua', quantity: 1, unit: 'l' }],
      steps: [{ text: 'Hervir.', durationSeconds: 180 }, { text: 'Servir.' }],
    })
  })

  it('pre-loads the timer paused with an "Iniciar" button', async () => {
    wrap()
    expect(await screen.findByTestId('cook-timer')).toHaveTextContent('03:00')
    expect(screen.getByTestId('cook-timer-toggle')).toHaveTextContent('Iniciar')
  })

  it('tapping the timer starts it (button flips to Pausar)', async () => {
    wrap()
    const toggle = await screen.findByTestId('cook-timer-toggle')
    fireEvent.click(toggle)
    await waitFor(() => expect(toggle).toHaveTextContent('Pausar'))
  })

  it('hides the timer on a step with no duration', async () => {
    wrap()
    await screen.findByTestId('cook-timer')
    // Advance to step 2 (no durationSeconds) → timer disappears.
    fireEvent.click(screen.getByTestId('cook-next'))
    await waitFor(() => expect(screen.queryByTestId('cook-timer')).not.toBeInTheDocument())
  })
})
