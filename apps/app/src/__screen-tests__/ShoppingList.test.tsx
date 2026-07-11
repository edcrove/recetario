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

import ShoppingListScreen from '../../app/menu/shopping-list'

const entry = (over: Partial<ShoppingListEntry>): ShoppingListEntry => ({
  ingredient: 'x',
  quantity: 1,
  unit: 'unit',
  key: 'x',
  aisle: 'otros',
  checked: false,
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
