import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MenuEntry } from '@recetario/shared'
import { getWeekStart, addDays, formatDate, localIsoDate } from '../utils/weekMath'

const {
  mockGetWeek,
  mockRemove,
  mockUpdate,
  mockPush,
  mockConfirm,
  mockNotify,
  mockIsViewer,
  mockSetStatus,
} = vi.hoisted(() => ({
  mockSetStatus: vi.fn().mockResolvedValue({}),
  mockGetWeek: vi.fn(),
  mockRemove: vi.fn().mockResolvedValue(undefined),
  mockUpdate: vi.fn().mockResolvedValue({}),
  mockPush: vi.fn(),
  mockConfirm: vi.fn(async () => true),
  mockNotify: vi.fn(),
  mockIsViewer: vi.fn(() => false),
}))

vi.mock('../api/client', () => ({
  api: {
    menu: {
      getWeek: mockGetWeek,
      remove: mockRemove,
      updateServings: mockUpdate,
      setStatus: mockSetStatus,
      dayNutrition: vi.fn().mockResolvedValue(null),
    },
  },
}))
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn(), replace: vi.fn() }),
}))
vi.mock('../utils/platformAlert', () => ({ confirmAsync: mockConfirm, notify: mockNotify }))
vi.mock('../hooks/useIsViewer', () => ({ useIsViewer: mockIsViewer }))

import MenuWeekScreen from '../../app/menu/index'

const monday = getWeekStart(new Date())
const RID = '550e8400-e29b-41d4-a716-446655440000'
const entry = (over: Partial<MenuEntry> = {}): MenuEntry =>
  ({
    date: addDays(monday, 1),
    slot: 'Cena',
    recipeId: RID,
    recipeName: 'Milanesas',
    servings: 4,
    ...over,
  }) as MenuEntry

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MenuWeekScreen />
    </QueryClientProvider>,
  )
}

describe('MenuWeekScreen (planner)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsViewer.mockReturnValue(false)
    mockConfirm.mockResolvedValue(true)
  })

  it('renders planned entries in their day/slot and an add button per slot', async () => {
    mockGetWeek.mockResolvedValue([entry()])
    wrap()
    const chip = await screen.findByTestId(`menu-entry-${addDays(monday, 1)}-Cena-${RID}`)
    expect(chip).toHaveTextContent('Milanesas')
    expect(chip).toHaveTextContent('4 porc.')
    expect(screen.getByTestId(`menu-add-${monday}-Desayuno`)).toBeInTheDocument()
  })

  it('shows a deleted recipe as a read-only snapshot', async () => {
    mockGetWeek.mockResolvedValue([entry({ recipeId: null, recipeName: 'Guiso viejo' })])
    wrap()
    expect(await screen.findByText(/Guiso viejo \(eliminada\)/)).toBeInTheDocument()
  })

  it('opens the picker for a slot', async () => {
    mockGetWeek.mockResolvedValue([])
    wrap()
    fireEvent.click(await screen.findByTestId(`menu-add-${monday}-Almuerzo`))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/menu/pick',
      params: { date: monday, slot: 'Almuerzo', weekStart: monday },
    })
  })

  it('the ✕ chip asks first and removes only when confirmed', async () => {
    mockGetWeek.mockResolvedValue([entry()])
    wrap()
    const remove = await screen.findByTestId(`menu-remove-${addDays(monday, 1)}-Cena-${RID}`)
    mockConfirm.mockResolvedValueOnce(false)
    fireEvent.click(remove)
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1))
    expect(mockRemove).not.toHaveBeenCalled()
    fireEvent.click(remove)
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith(addDays(monday, 1), 'Cena', RID))
  })

  it('edits servings from the modal', async () => {
    mockGetWeek.mockResolvedValue([entry()])
    wrap()
    fireEvent.click(await screen.findByTestId(`menu-entry-${addDays(monday, 1)}-Cena-${RID}`))
    fireEvent.click(screen.getByText('+'))
    fireEvent.click(screen.getByTestId('menu-modal-save'))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(addDays(monday, 1), 'Cena', RID, 5))
  })

  it('notifies when removing fails', async () => {
    mockGetWeek.mockResolvedValue([entry()])
    mockRemove.mockRejectedValueOnce(new Error('boom'))
    wrap()
    fireEvent.click(await screen.findByTestId(`menu-entry-${addDays(monday, 1)}-Cena-${RID}`))
    fireEvent.click(screen.getByTestId('menu-modal-delete'))
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('Error', 'No se pudo quitar la receta del menú.'),
    )
  })

  it('viewers get the read-only notice and no add/remove controls', async () => {
    mockIsViewer.mockReturnValue(true)
    mockGetWeek.mockResolvedValue([entry()])
    wrap()
    expect(await screen.findByTestId('viewer-notice')).toBeInTheDocument()
    expect(screen.queryByTestId(`menu-add-${monday}-Desayuno`)).toBeNull()
    expect(screen.queryByTestId(`menu-remove-${addDays(monday, 1)}-Cena-${RID}`)).toBeNull()
  })

  it('navigates weeks with Anterior/Siguiente', async () => {
    mockGetWeek.mockResolvedValue([])
    wrap()
    await screen.findByTestId('menu-week-label')
    fireEvent.click(screen.getByText('‹ Anterior'))
    await waitFor(() => expect(mockGetWeek).toHaveBeenCalledWith(addDays(monday, -7)))
    // Each new week loads (spinner) before the nav shows again
    fireEvent.click(await screen.findByText('Siguiente ›'))
    fireEvent.click(await screen.findByText('Siguiente ›'))
    await waitFor(() => expect(mockGetWeek).toHaveBeenCalledWith(addDays(monday, 7)))
  })

  it('marks a planned dish as cooked or skipped from the modal', async () => {
    mockGetWeek.mockResolvedValue([entry({ status: 'planned' })])
    wrap()
    fireEvent.click(await screen.findByTestId(`menu-entry-${addDays(monday, 1)}-Cena-${RID}`))
    // Only the other two states are offered
    expect(screen.queryByTestId('menu-modal-status-planned')).toBeNull()
    fireEvent.click(screen.getByTestId('menu-modal-status-skipped'))
    await waitFor(() =>
      expect(mockSetStatus).toHaveBeenCalledWith(addDays(monday, 1), 'Cena', RID, 'skipped'),
    )
  })

  it('shows cooked dishes with a check and skipped ones struck through', async () => {
    mockGetWeek.mockResolvedValue([
      entry({ status: 'cooked' }),
      entry({ slot: 'Almuerzo', recipeName: 'Guiso', status: 'skipped' }),
    ])
    wrap()
    expect(
      await screen.findByTestId(`menu-entry-${addDays(monday, 1)}-Cena-${RID}`),
    ).toHaveTextContent('✓ Milanesas')
    expect(screen.getByText('Guiso')).toBeInTheDocument()
  })

  it('notifies when the status update fails', async () => {
    mockGetWeek.mockResolvedValue([entry({ status: 'cooked' })])
    mockSetStatus.mockRejectedValueOnce(new Error('boom'))
    wrap()
    fireEvent.click(await screen.findByTestId(`menu-entry-${addDays(monday, 1)}-Cena-${RID}`))
    fireEvent.click(screen.getByTestId('menu-modal-status-planned'))
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('Error', 'No se pudo actualizar el estado.'),
    )
  })

  it('marks today as Hoy (aria-current), and only today', async () => {
    mockGetWeek.mockResolvedValue([])
    wrap()
    const today = localIsoDate(new Date())
    const card = await screen.findByTestId(`menu-day-${today}`)
    expect(card).toHaveAttribute('aria-current', 'date')
    expect(card).toHaveTextContent(`Hoy · ${formatDate(today)}`)
    const other = today === monday ? addDays(monday, 1) : monday
    expect(screen.getByTestId(`menu-day-${other}`)).not.toHaveAttribute('aria-current')
    expect(screen.getAllByText(/^Hoy · /)).toHaveLength(1)
    fireEvent.click(screen.getByText('Siguiente ›'))
    await waitFor(() => expect(screen.queryByTestId(`menu-day-${today}`)).toBeNull())
    expect(screen.queryByText(/^Hoy · /)).toBeNull()
  })
})
