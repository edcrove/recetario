import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockCollectionRecipes, mockRemoveFromCollection, mockPush } = vi.hoisted(() => ({
  mockCollectionRecipes: vi.fn(),
  mockRemoveFromCollection: vi.fn().mockResolvedValue(undefined),
  mockPush: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: {
    taxonomy: {
      collectionRecipes: mockCollectionRecipes,
      removeFromCollection: mockRemoveFromCollection,
    },
  },
}))

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn(), replace: vi.fn() }),
  useLocalSearchParams: () => ({ id: 'col-1', name: 'Postres', emoji: '🍰' }),
}))

vi.mock('../utils/platformAlert', () => ({
  notify: vi.fn(),
  confirmAsync: vi.fn().mockResolvedValue(true),
}))

import CollectionDetailScreen from '../../app/collections/[id]'

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('CollectionDetailScreen', () => {
  beforeEach(() => {
    mockCollectionRecipes.mockReset()
    mockRemoveFromCollection.mockReset().mockResolvedValue(undefined)
    mockPush.mockReset()
  })

  it('renders the collection name and emoji from route params', async () => {
    mockCollectionRecipes.mockResolvedValue([])
    wrap(<CollectionDetailScreen />)
    expect(await screen.findByTestId('collection-detail-title')).toHaveTextContent('🍰 Postres')
  })

  it('shows an empty state when the collection has no recipes', async () => {
    mockCollectionRecipes.mockResolvedValue([])
    wrap(<CollectionDetailScreen />)
    expect(await screen.findByTestId('collection-detail-empty')).toBeInTheDocument()
  })

  it('renders each recipe in the collection', async () => {
    mockCollectionRecipes.mockResolvedValue([
      { id: 'r1', title: 'Tarta de Manzana', category: 'Postre', servings: 8 },
      { id: 'r2', title: 'Flan', category: 'Postre', servings: 6 },
    ])
    wrap(<CollectionDetailScreen />)
    expect(await screen.findByText('Tarta de Manzana')).toBeInTheDocument()
    expect(await screen.findByText('Flan')).toBeInTheDocument()
    expect(screen.getByText(/8 porciones/)).toBeInTheDocument()
  })

  it('navigates to the recipe detail screen when a recipe is tapped', async () => {
    mockCollectionRecipes.mockResolvedValue([
      { id: 'r1', title: 'Tarta de Manzana', category: 'Postre', servings: 8 },
    ])
    wrap(<CollectionDetailScreen />)
    const row = await screen.findByTestId('collection-recipe-r1')
    fireEvent.click(row)
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/recipe/[id]',
      params: { id: 'r1' },
    })
  })

  it('removes a recipe from the collection after confirming', async () => {
    mockCollectionRecipes.mockResolvedValue([
      { id: 'r1', title: 'Tarta de Manzana', category: 'Postre', servings: 8 },
    ])
    wrap(<CollectionDetailScreen />)
    const removeBtn = await screen.findByTestId('collection-remove-r1')
    fireEvent.click(removeBtn)
    await waitFor(() => expect(mockRemoveFromCollection).toHaveBeenCalledWith('col-1', 'r1'))
  })

  it('shows an error message if loading the collection fails', async () => {
    mockCollectionRecipes.mockRejectedValue(new Error('network error'))
    wrap(<CollectionDetailScreen />)
    expect(await screen.findByText('No se pudo cargar la colección.')).toBeInTheDocument()
  })
})
