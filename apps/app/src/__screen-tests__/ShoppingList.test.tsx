import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ShoppingListEntry } from '@recetario/shared'

const { mockShoppingList, mockSetCheck, mockBack } = vi.hoisted(() => ({
  mockShoppingList: vi.fn(),
  mockSetCheck: vi.fn().mockResolvedValue({ ok: true }),
  mockBack: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: { menu: { shoppingList: mockShoppingList, setShoppingCheck: mockSetCheck } },
}))

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), back: mockBack, replace: vi.fn() }),
  useLocalSearchParams: () => ({ weekStart: '2026-07-06' }),
}))

const { mockIsViewer } = vi.hoisted(() => ({ mockIsViewer: vi.fn(() => false) }))

const { mockCopy, mockNotify } = vi.hoisted(() => ({
  mockCopy: vi.fn().mockResolvedValue(true),
  mockNotify: vi.fn(),
}))
vi.mock('expo-clipboard', () => ({ setStringAsync: mockCopy }))
vi.mock('../utils/platformAlert', () => ({ notify: mockNotify, confirmAsync: vi.fn() }))
vi.mock('../hooks/useIsViewer', () => ({ useIsViewer: mockIsViewer }))

import ShoppingListScreen from '../../app/menu/shopping-list'

const entry = (over: Partial<ShoppingListEntry>): ShoppingListEntry => ({
  ingredient: 'x',
  quantity: 1,
  unit: 'unit',
  key: 'x',
  aisle: 'otros',
  checked: false,
  pantryMatch: false,
  ...over,
})

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('ShoppingListScreen', () => {
  beforeEach(() => {
    mockShoppingList.mockReset()
    mockSetCheck.mockReset().mockResolvedValue({ ok: true })
    mockBack.mockReset()
  })

  it('shows the empty state when there are no ingredients', async () => {
    mockShoppingList.mockResolvedValue([])
    wrap(<ShoppingListScreen />)
    expect(await screen.findByText('No hay ingredientes para esta semana')).toBeInTheDocument()
  })

  it('renders aisle section headers and overall progress', async () => {
    mockShoppingList.mockResolvedValue([
      entry({ ingredient: 'Tomate', key: 'tomate', aisle: 'verduleria', checked: true }),
      entry({ ingredient: 'Harina', key: 'harina', aisle: 'almacen', quantity: 500, unit: 'g' }),
    ])
    wrap(<ShoppingListScreen />)
    expect(await screen.findByText('Verdulería')).toBeInTheDocument()
    expect(screen.getByText('Almacén')).toBeInTheDocument()
    // 1 of 2 checked
    expect(screen.getByTestId('shopping-progress')).toHaveTextContent('1 / 2')
  })

  it('persists a check and optimistically ticks the item', async () => {
    mockShoppingList.mockResolvedValue([
      entry({ ingredient: 'Harina', key: 'harina', aisle: 'almacen', quantity: 500, unit: 'g' }),
    ])
    wrap(<ShoppingListScreen />)
    const row = await screen.findByTestId('shopping-item-harina')

    fireEvent.click(row)

    await waitFor(() => expect(mockSetCheck).toHaveBeenCalledWith('2026-07-06', 'harina', true))
    // Optimistic update moves progress to 1 / 1
    await waitFor(() => expect(screen.getByTestId('shopping-progress')).toHaveTextContent('1 / 1'))
  })

  it('viewers see a read-only notice and cannot check items off', async () => {
    mockIsViewer.mockReturnValue(true)
    mockShoppingList.mockResolvedValue([
      entry({ ingredient: 'Harina', key: 'harina', aisle: 'almacen' }),
    ])
    wrap(<ShoppingListScreen />)
    fireEvent.click(await screen.findByTestId('shopping-item-harina'))
    expect(screen.getByTestId('viewer-notice')).toBeInTheDocument()
    expect(mockSetCheck).not.toHaveBeenCalled()
    mockIsViewer.mockReturnValue(false)
  })

  it('rolls back the optimistic tick when the request fails', async () => {
    mockShoppingList.mockResolvedValue([
      entry({ ingredient: 'Harina', key: 'harina', aisle: 'almacen' }),
    ])
    mockSetCheck.mockRejectedValueOnce(new Error('network'))
    wrap(<ShoppingListScreen />)
    const row = await screen.findByTestId('shopping-item-harina')

    fireEvent.click(row)

    // After the failure the progress returns to 0 / 1
    await waitFor(() => expect(screen.getByTestId('shopping-progress')).toHaveTextContent('0 / 1'))
  })

  it('goes back to the menu when the back link is pressed', async () => {
    mockShoppingList.mockResolvedValue([])
    wrap(<ShoppingListScreen />)
    await screen.findByText('No hay ingredientes para esta semana')
    fireEvent.click(screen.getByText('‹ Menú'))
    expect(mockBack).toHaveBeenCalled()
  })
})

// Story "Expo: shopping list UI": "Copy-to-clipboard button (plain text
// format)" and "Refresh button to regenerate from current menu".
describe('ShoppingListScreen: copy and refresh', () => {
  beforeEach(() => {
    mockShoppingList.mockReset()
    mockCopy.mockReset().mockResolvedValue(true)
    mockNotify.mockReset()
  })

  it('copies what is left to buy as plain text and confirms it', async () => {
    mockShoppingList.mockResolvedValue([
      entry({ ingredient: 'Tomate', key: 'tomate', aisle: 'verduleria', quantity: 2 }),
      entry({ ingredient: 'Leche', key: 'leche', aisle: 'lacteos', checked: true }),
    ])
    wrap(<ShoppingListScreen />)
    fireEvent.click(await screen.findByTestId('shopping-copy'))
    await waitFor(() => expect(mockCopy).toHaveBeenCalledTimes(1))
    const text = mockCopy.mock.calls[0]![0] as string
    expect(text.split('\n')[0]).toMatch(/^Lista de compras · semana del /)
    expect(text).toContain('Verdulería\n- Tomate: 2 u')
    expect(text).not.toContain('Leche')
    expect(await screen.findByTestId('shopping-copy')).toHaveTextContent('✓ Copiada')
  })

  it('the confirmation goes back to the button label after a moment', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      mockShoppingList.mockResolvedValue([entry({ ingredient: 'Tomate', key: 'tomate' })])
      wrap(<ShoppingListScreen />)
      fireEvent.click(await screen.findByTestId('shopping-copy'))
      await screen.findByText('✓ Copiada')
      vi.advanceTimersByTime(2600)
      expect(await screen.findByText('📋 Copiar lista')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('with everything ticked off it says so instead of copying', async () => {
    mockShoppingList.mockResolvedValue([entry({ checked: true })])
    wrap(<ShoppingListScreen />)
    fireEvent.click(await screen.findByTestId('shopping-copy'))
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'Lista completa',
        'No queda nada por comprar esta semana.',
      ),
    )
    expect(mockCopy).not.toHaveBeenCalled()
  })

  it('an empty list disables copying', async () => {
    mockShoppingList.mockResolvedValue([])
    wrap(<ShoppingListScreen />)
    expect(await screen.findByTestId('shopping-copy')).toBeDisabled()
  })

  it('reports when the browser refuses the clipboard (web resolves false)', async () => {
    mockShoppingList.mockResolvedValue([entry({ ingredient: 'Tomate', key: 'tomate' })])
    mockCopy.mockResolvedValueOnce(false)
    wrap(<ShoppingListScreen />)
    fireEvent.click(await screen.findByTestId('shopping-copy'))
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'No se pudo copiar',
        'Tu navegador no permitió copiar al portapapeles.',
      ),
    )
    expect(screen.getByTestId('shopping-copy')).toHaveTextContent('📋 Copiar lista')
  })

  it('reports when the native clipboard rejects', async () => {
    mockShoppingList.mockResolvedValue([entry({ ingredient: 'Tomate', key: 'tomate' })])
    mockCopy.mockRejectedValueOnce(new Error('NotAllowedError'))
    wrap(<ShoppingListScreen />)
    fireEvent.click(await screen.findByTestId('shopping-copy'))
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'No se pudo copiar',
        'Tu navegador no permitió copiar al portapapeles.',
      ),
    )
    expect(screen.getByTestId('shopping-copy')).toHaveTextContent('📋 Copiar lista')
  })

  it('Actualizar refetches the list from the current menu', async () => {
    mockShoppingList
      .mockResolvedValueOnce([entry({ ingredient: 'Tomate', key: 'tomate' })])
      .mockResolvedValueOnce([
        entry({ ingredient: 'Tomate', key: 'tomate' }),
        entry({ ingredient: 'Papa', key: 'papa' }),
      ])
    wrap(<ShoppingListScreen />)
    await screen.findByText('Tomate')
    expect(screen.queryByText('Papa')).toBeNull()
    fireEvent.click(screen.getByTestId('shopping-refresh'))
    expect(await screen.findByText('Papa')).toBeInTheDocument()
    expect(mockShoppingList).toHaveBeenCalledTimes(2)
    expect(mockShoppingList).toHaveBeenLastCalledWith('2026-07-06')
  })

  it('Actualizar shows that it is working and cannot be double-tapped', async () => {
    let release: (v: ShoppingListEntry[]) => void = () => undefined
    mockShoppingList
      .mockResolvedValueOnce([entry({ ingredient: 'Tomate', key: 'tomate' })])
      .mockReturnValueOnce(new Promise((r) => (release = r)))
    wrap(<ShoppingListScreen />)
    await screen.findByText('Tomate')
    fireEvent.click(screen.getByTestId('shopping-refresh'))
    await screen.findByText('Actualizando…')
    expect(screen.getByTestId('shopping-refresh')).toBeDisabled()
    release([entry({ ingredient: 'Tomate', key: 'tomate' })])
    await waitFor(() =>
      expect(screen.getByTestId('shopping-refresh')).toHaveTextContent('↻ Actualizar'),
    )
    expect(screen.getByTestId('shopping-refresh')).not.toBeDisabled()
  })
})
