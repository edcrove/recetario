import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockList, mockCreate, mockUpdate, mockRemove } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn().mockResolvedValue({ id: 'new' }),
  mockUpdate: vi.fn().mockResolvedValue({ id: 'x' }),
  mockRemove: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../api/client', () => ({
  api: { pantry: { list: mockList, create: mockCreate, update: mockUpdate, remove: mockRemove } },
}))
vi.mock('expo-router', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }))
const { mockNotify, mockConfirm } = vi.hoisted(() => ({
  mockNotify: vi.fn(),
  mockConfirm: vi.fn(async () => true),
}))
vi.mock('../utils/platformAlert', () => ({ notify: mockNotify, confirmAsync: mockConfirm }))

const { mockIsViewer } = vi.hoisted(() => ({ mockIsViewer: vi.fn(() => false) }))
vi.mock('../hooks/useIsViewer', () => ({ useIsViewer: mockIsViewer }))

import PantryScreen from '../../app/pantry/index'

const seed = () => [
  {
    id: 'arroz',
    ownerId: 'o',
    name: 'Arroz',
    quantity: '1',
    unit: 'kg',
    expiryDate: null,
    inStock: true,
  },
  {
    id: 'leche',
    ownerId: 'o',
    name: 'Leche',
    quantity: null,
    unit: null,
    expiryDate: '2020-01-01', // past → vencido
    inStock: true,
  },
  {
    id: 'sal',
    ownerId: 'o',
    name: 'Sal',
    quantity: null,
    unit: null,
    expiryDate: null,
    inStock: false,
  },
]

function wrap(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(
    <QueryClientProvider client={client}>
      <PantryScreen />
    </QueryClientProvider>,
  )
}

describe('PantryScreen', () => {
  beforeEach(() => {
    mockList.mockReset().mockResolvedValue(seed())
    mockCreate.mockClear()
    mockUpdate.mockClear()
    mockRemove.mockClear()
  })

  it('groups items into En casa / Se acabó with an expiry badge', async () => {
    wrap()
    expect(await screen.findByText('En casa')).toBeInTheDocument()
    expect(screen.getByText('Se acabó')).toBeInTheDocument()
    expect(screen.getByTestId('pantry-expiry-leche')).toHaveTextContent('Vencido')
    expect(screen.getByText('1 kg')).toBeInTheDocument()
  })

  it('shows the empty state when the pantry has no items', async () => {
    mockList.mockResolvedValue([])
    wrap()
    expect(await screen.findByText(/Tu despensa está vacía/)).toBeInTheDocument()
  })

  it('adds an item', async () => {
    wrap()
    await screen.findByText('En casa')
    fireEvent.change(screen.getByTestId('pantry-new-name'), { target: { value: 'Fideos' } })
    fireEvent.click(screen.getByTestId('pantry-add'))
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ name: 'Fideos', inStock: true }))
  })

  // 2026-10-02 review: only ['pantry'] was refreshed, so "Tu semana" kept saying
  // "falta: …" for what you had just added (cached for 30s).
  it('adding, toggling or deleting refreshes what reads the pantry', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const spy = vi.spyOn(client, 'invalidateQueries')
    const refreshed = () => spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))
    wrap(client)
    await screen.findByText('En casa')
    fireEvent.change(screen.getByTestId('pantry-new-name'), { target: { value: 'Fideos' } })
    fireEvent.click(screen.getByTestId('pantry-add'))
    await waitFor(() =>
      expect(refreshed()).toEqual([
        '["pantry"]',
        '["shopping-list"]',
        '["menu-gap"]',
        '["suggestions"]',
      ]),
    )
    spy.mockClear()
    fireEvent.click(screen.getByTestId('pantry-toggle-arroz'))
    await waitFor(() => expect(refreshed()).toContain('["menu-gap"]'))
    spy.mockClear()
    fireEvent.click(screen.getByTestId('pantry-delete-sal'))
    await waitFor(() => expect(refreshed()).toContain('["menu-gap"]'))
  })

  it('toggles stock on an item', async () => {
    wrap()
    await screen.findByText('En casa')
    fireEvent.click(screen.getByTestId('pantry-toggle-arroz'))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('arroz', { inStock: false }))
  })

  it('deletes an item', async () => {
    wrap()
    await screen.findByText('En casa')
    fireEvent.click(screen.getByTestId('pantry-delete-sal'))
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('sal'))
  })

  it('asks before deleting and keeps the item when cancelled', async () => {
    mockRemove.mockClear()
    mockConfirm.mockResolvedValueOnce(false)
    wrap()
    await screen.findByText('En casa')
    fireEvent.click(screen.getByTestId('pantry-delete-sal'))
    await waitFor(() =>
      expect(mockConfirm).toHaveBeenCalledWith(
        'Eliminar de la despensa',
        expect.stringContaining('Sal'),
      ),
    )
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('notifies when a mutation fails', async () => {
    mockNotify.mockClear()
    mockCreate.mockRejectedValueOnce(new Error('network'))
    wrap()
    await screen.findByText('En casa')
    fireEvent.change(screen.getByTestId('pantry-new-name'), { target: { value: 'Fideos' } })
    fireEvent.click(screen.getByTestId('pantry-add'))
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('Error', 'No se pudo agregar el ítem.'),
    )
  })

  it('shows the error state and retries', async () => {
    mockList.mockRejectedValueOnce(new Error('boom'))
    wrap()
    expect(await screen.findByText('Error al cargar la despensa')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Reintentar'))
    expect(await screen.findByText('En casa')).toBeInTheDocument()
  })

  it('viewers get a read-only notice instead of add/delete controls', async () => {
    mockIsViewer.mockReturnValue(true)
    mockUpdate.mockClear()
    wrap()
    await screen.findByText('En casa')
    expect(screen.getByTestId('viewer-notice')).toBeInTheDocument()
    expect(screen.queryByTestId('pantry-add')).toBeNull()
    expect(screen.queryByTestId('pantry-delete-arroz')).toBeNull()
    fireEvent.click(screen.getByTestId('pantry-toggle-arroz'))
    expect(mockUpdate).not.toHaveBeenCalled()
    mockIsViewer.mockReturnValue(false)
  })
})
