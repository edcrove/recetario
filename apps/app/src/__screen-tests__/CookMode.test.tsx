import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockGet, mockLog, mockConfirm, router, params } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockLog: vi.fn(),
  mockConfirm: vi.fn(),
  router: { back: vi.fn(), push: vi.fn(), replace: vi.fn(), canGoBack: vi.fn(() => true) },
  params: { current: { id: 'r1' } as Record<string, string> },
}))

vi.mock('../api/client', () => ({
  api: { recipes: { get: mockGet }, cookSessions: { log: mockLog } },
}))
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => params.current,
  useRouter: () => router,
}))
vi.mock('../utils/platformAlert', () => ({ confirmAsync: mockConfirm, notify: vi.fn() }))
vi.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: vi.fn().mockResolvedValue(undefined),
  deactivateKeepAwake: vi.fn(),
}))
vi.mock('../utils/cookEffects', () => ({
  timerDoneMessage: (i: number) => `¡Tiempo! Terminó el paso ${i + 1}.`,
  onStepTimerComplete: vi.fn(),
  startSpeech: vi.fn().mockReturnValue(false),
  stopSpeech: vi.fn(),
}))

import CookModeScreen from '../../app/recipe/[id]/cook'
import { onStepTimerComplete, stopSpeech } from '../utils/cookEffects'

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
    params.current = { id: 'r1' }
    router.back.mockReset()
    router.replace.mockReset()
    router.canGoBack.mockReset().mockReturnValue(true)
    mockConfirm.mockReset()
    mockLog.mockReset().mockResolvedValue({ id: 's1' })
    vi.mocked(stopSpeech).mockClear()
    mockGet.mockReset().mockResolvedValue({
      id: 'r1',
      title: 'Guiso',
      servings: 2,
      category: 'Cena',
      tags: [],
      images: [],
      ingredients: [
        { name: 'Agua', quantity: 1, unit: 'l' },
        { name: 'ajo', quantity: 2, unit: 'clove' },
      ],
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

  it('scales the ingredient list to the servings chosen on the detail screen', async () => {
    params.current = { id: 'r1', servings: '4', mode: 'cooking' }
    wrap()
    fireEvent.click(await screen.findByTestId('cook-tab-ingredients'))
    expect(screen.getByText('2 l Agua')).toBeInTheDocument()
    expect(screen.getByText('4 diente ajo')).toBeInTheDocument()
  })

  it('falls back to the recipe servings and cooking mode without params', async () => {
    params.current = { id: 'r1', servings: 'abc', mode: 'bogus' }
    wrap()
    fireEvent.click(await screen.findByTestId('cook-tab-ingredients'))
    expect(screen.getByText('1 l Agua')).toBeInTheDocument()
  })

  it('honours the metric mode from the detail screen', async () => {
    params.current = { id: 'r1', mode: 'metric' }
    wrap()
    fireEvent.click(await screen.findByTestId('cook-tab-ingredients'))
    expect(screen.getByText('1 l Agua')).toBeInTheDocument()
  })

  it('keeps a running timer visible in the top bar after moving on, and jumps back', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('cook-timer-toggle'))
    fireEvent.click(screen.getByTestId('cook-next'))
    const chip = await screen.findByTestId('cook-running-timer-0')
    expect(chip).toHaveTextContent('Paso 1')
    fireEvent.click(chip)
    await waitFor(() => expect(screen.getByTestId('cook-timer-toggle')).toHaveTextContent('Pausar'))
    expect(screen.queryByTestId('cook-running-timer-0')).not.toBeInTheDocument()
  })

  it('pauses and resets the current step timer', async () => {
    wrap()
    const toggle = await screen.findByTestId('cook-timer-toggle')
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    await waitFor(() => expect(toggle).toHaveTextContent('Reanudar'))
    fireEvent.click(screen.getByTestId('cook-timer-reset'))
    await waitFor(() => expect(toggle).toHaveTextContent('Iniciar'))
  })

  it('exits without asking on step 1 with no timer running', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('cook-exit'))
    await waitFor(() => expect(router.back).toHaveBeenCalled())
    expect(mockConfirm).not.toHaveBeenCalled()
  })

  it('asks before exiting past step 1 and stays when cancelled', async () => {
    mockConfirm.mockResolvedValue(false)
    wrap()
    fireEvent.click(await screen.findByTestId('cook-next'))
    fireEvent.click(screen.getByTestId('cook-exit'))
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled())
    expect(router.back).not.toHaveBeenCalled()
  })

  it('asks before exiting with a running timer and leaves when confirmed', async () => {
    mockConfirm.mockResolvedValue(true)
    router.canGoBack.mockReturnValue(false)
    const view = wrap()
    fireEvent.click(await screen.findByTestId('cook-timer-toggle'))
    fireEvent.click(screen.getByTestId('cook-exit'))
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/recipe/r1'))
    view.unmount()
    expect(stopSpeech).toHaveBeenCalled()
  })

  it('skipping the rating still logs the session, unrated', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('cook-next'))
    fireEvent.click(screen.getByTestId('cook-finish'))
    fireEvent.click(await screen.findByTestId('cook-rating-skip'))
    await waitFor(() =>
      expect(mockLog).toHaveBeenCalledWith({
        recipeId: 'r1',
        rating: null,
        notes: undefined,
        servings: 2,
        source: 'app',
      }),
    )
    await waitFor(() => expect(router.back).toHaveBeenCalled())
  })

  it('saving the rating logs it with the note', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('cook-next'))
    fireEvent.click(screen.getByTestId('cook-finish'))
    await screen.findByTestId('cook-rating-save')
    fireEvent.click(screen.getAllByText('★')[3]!)
    fireEvent.change(screen.getByPlaceholderText('Agregar nota (opcional)'), {
      target: { value: ' rico ' },
    })
    fireEvent.click(screen.getByTestId('cook-rating-save'))
    await waitFor(() =>
      expect(mockLog).toHaveBeenCalledWith({
        recipeId: 'r1',
        rating: 4,
        notes: 'rico',
        servings: 2,
        source: 'app',
      }),
    )
  })
})

// AC (story "Cook mode: per-step countdown timers"): when the timer reaches
// 0:00 a visible alert and an audible notification are triggered. A 1-second
// step runs to completion on the real clock.
describe('CookModeScreen timer reaching 0:00', () => {
  beforeEach(() => {
    params.current = { id: 'r1' }
    vi.mocked(onStepTimerComplete).mockClear()
    mockGet.mockReset().mockResolvedValue({
      id: 'r1',
      title: 'Guiso',
      servings: 2,
      category: 'Cena',
      tags: [],
      images: [],
      ingredients: [],
      steps: [
        { text: 'Hervir.', durationSeconds: 1 },
        { text: 'Reposar.', durationSeconds: 1 },
        { text: 'Servir.' },
      ],
    })
  })

  async function runStepOneToZero() {
    wrap()
    fireEvent.click(await screen.findByTestId('cook-timer-toggle'))
    return screen.findByTestId('cook-timer-done-0', {}, { timeout: 3000 })
  }

  it('shows a visible alert naming the step and fires the audible cue once', async () => {
    const banner = await runStepOneToZero()
    expect(banner).toHaveTextContent('¡Tiempo! Terminó el paso 1.')
    expect(banner).toHaveAttribute('role', 'alert')
    expect(screen.getByTestId('cook-timer')).toHaveTextContent('00:00')
    expect(onStepTimerComplete).toHaveBeenCalledTimes(1)
    expect(onStepTimerComplete).toHaveBeenCalledWith(0)
  })

  it('no alert before the timer reaches 0:00', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('cook-timer-toggle'))
    expect(screen.queryByTestId('cook-timer-done-0')).not.toBeInTheDocument()
    expect(onStepTimerComplete).not.toHaveBeenCalled()
  })

  it('OK dismisses the alert', async () => {
    await runStepOneToZero()
    fireEvent.click(screen.getByTestId('cook-timer-done-dismiss-0'))
    await waitFor(() => expect(screen.queryByTestId('cook-timer-done-0')).not.toBeInTheDocument())
  })

  it('a timer finishing on another step alerts there too, and "Ver paso" jumps back to it', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('cook-timer-toggle'))
    fireEvent.click(screen.getByTestId('cook-next'))
    expect(await screen.findByText(/Paso 2 \/ 3/)).toBeInTheDocument()
    const banner = await screen.findByTestId('cook-timer-done-0', {}, { timeout: 3000 })
    expect(banner).toHaveTextContent('Terminó el paso 1')
    fireEvent.click(screen.getByTestId('cook-timer-done-goto-0'))
    expect(await screen.findByText(/Paso 1 \/ 3/)).toBeInTheDocument()
    expect(screen.queryByTestId('cook-timer-done-0')).not.toBeInTheDocument()
  })

  it('on the finished step itself there is no "Ver paso" button', async () => {
    await runStepOneToZero()
    expect(screen.queryByTestId('cook-timer-done-goto-0')).not.toBeInTheDocument()
  })

  it('two finished timers show two alerts', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('cook-timer-toggle'))
    fireEvent.click(screen.getByTestId('cook-next'))
    fireEvent.click(await screen.findByTestId('cook-timer-toggle'))
    await screen.findByTestId('cook-timer-done-1', {}, { timeout: 3000 })
    expect(screen.getByTestId('cook-timer-done-0')).toBeInTheDocument()
    expect(onStepTimerComplete).toHaveBeenCalledWith(1)
    expect(onStepTimerComplete).toHaveBeenCalledTimes(2)
  })
})
