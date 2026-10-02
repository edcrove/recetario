import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockCollections, mockPush } = vi.hoisted(() => ({
  mockCollections: vi.fn(),
  mockPush: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: { taxonomy: { collections: mockCollections, createCollection: vi.fn() } },
}))
vi.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
vi.mock('../utils/platformAlert', () => ({ notify: vi.fn() }))

import CollectionsScreen from '../../app/collections/index'

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CollectionsScreen />
    </QueryClientProvider>,
  )
}

// 2026-10-02 review: opening a collection from the list dropped its emoji, so
// the detail header always showed 📋 instead of the collection's own icon.
describe('CollectionsScreen', () => {
  it('opens a collection with its name and emoji, and without one when it has none', async () => {
    mockCollections.mockResolvedValue([
      { id: 'c1', name: 'Postres', emoji: '🍰', description: null, recipeCount: 2 },
      { id: 'c2', name: 'Guisos', emoji: null, description: null, recipeCount: 1 },
    ])
    wrap()
    fireEvent.click(await screen.findByTestId('collection-c1'))
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/collections/[id]',
      params: { id: 'c1', name: 'Postres', emoji: '🍰' },
    })
    fireEvent.click(screen.getByTestId('collection-c2'))
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/collections/[id]',
      params: { id: 'c2', name: 'Guisos' },
    })
    expect(screen.getByTestId('collection-c1')).toHaveTextContent('2 recetas')
    expect(screen.getByTestId('collection-c2')).toHaveTextContent('1 receta')
  })
})
