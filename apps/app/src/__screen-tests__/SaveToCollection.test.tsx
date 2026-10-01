import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockCollections, mockCreate, mockAdd, mockNotify } = vi.hoisted(() => ({
  mockCollections: vi.fn(),
  mockCreate: vi.fn(),
  mockAdd: vi.fn(),
  mockNotify: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: {
    taxonomy: {
      collections: mockCollections,
      createCollection: mockCreate,
      addToCollection: mockAdd,
    },
  },
}))
vi.mock('../utils/platformAlert', () => ({ notify: mockNotify, confirmAsync: vi.fn() }))

import { SaveToCollection } from '../components/SaveToCollection'

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SaveToCollection recipeId="r1" />
    </QueryClientProvider>,
  )
}

describe('SaveToCollection', () => {
  beforeEach(() => {
    mockCollections.mockReset().mockResolvedValue([
      { id: 'c1', name: 'Postres', emoji: '🍰', description: null, recipeCount: 2 },
      { id: 'c2', name: 'Rápidas', emoji: null, description: null, recipeCount: 0 },
    ])
    mockCreate.mockReset()
    mockAdd.mockReset().mockResolvedValue({ collectionId: 'c1', recipeId: 'r1' })
    mockNotify.mockReset()
  })

  it('stays closed and does not fetch until opened', () => {
    wrap()
    expect(screen.queryByTestId('collection-picker')).not.toBeInTheDocument()
    expect(mockCollections).not.toHaveBeenCalled()
  })

  it('lists the collections and saves into the picked one', async () => {
    wrap()
    fireEvent.click(screen.getByTestId('recipe-save-to-collection'))
    expect(await screen.findByText('📋 Rápidas')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('collection-pick-c1'))
    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith('c1', 'r1'))
    expect(await screen.findByTestId('collection-saved-msg')).toHaveTextContent('Postres')
    expect(screen.queryByTestId('collection-picker')).not.toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('creates a new collection inline and saves into it', async () => {
    mockCreate.mockResolvedValue({ id: 'c9', name: 'Fiesta', emoji: null })
    wrap()
    fireEvent.click(screen.getByTestId('recipe-save-to-collection'))
    expect(screen.getByTestId('collection-new-save')).toBeDisabled()
    fireEvent.change(screen.getByTestId('collection-new-name'), { target: { value: ' Fiesta ' } })
    fireEvent.click(screen.getByTestId('collection-new-save'))
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ name: 'Fiesta' }))
    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith('c9', 'r1'))
    expect(await screen.findByTestId('collection-saved-msg')).toHaveTextContent('Fiesta')
  })

  it('notifies when saving fails', async () => {
    mockAdd.mockRejectedValue(new Error('boom'))
    wrap()
    fireEvent.click(screen.getByTestId('recipe-save-to-collection'))
    fireEvent.click(await screen.findByTestId('collection-pick-c2'))
    await waitFor(() => expect(mockNotify).toHaveBeenCalled())
  })

  it('toggles the picker closed again', async () => {
    wrap()
    fireEvent.click(screen.getByTestId('recipe-save-to-collection'))
    await screen.findByTestId('collection-pick-c1')
    fireEvent.click(screen.getByTestId('recipe-save-to-collection'))
    expect(screen.queryByTestId('collection-picker')).not.toBeInTheDocument()
  })
})
