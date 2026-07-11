import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockList, mockCreate, mockMove } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn().mockResolvedValue({ id: 'new', name: 'Kale', normalizedName: 'kale' }),
  mockMove: vi.fn().mockResolvedValue({ id: 's', synonym: 'pechuga' }),
}))

vi.mock('../api/client', () => ({
  api: {
    ingredients: { list: mockList, createCanonical: mockCreate, moveSynonym: mockMove },
  },
}))

vi.mock('../utils/platformAlert', () => ({ notify: vi.fn() }))

import { IngredientsPanel } from '../components/IngredientsPanel'

const seed = () => [
  {
    id: 'pollo',
    name: 'Pollo',
    normalizedName: 'pollo',
    familyId: 'f',
    familyName: 'pollo',
    isSystem: true,
    synonyms: [{ id: 'syn-pechuga', synonym: 'pechuga', isSystem: true }],
  },
  {
    id: 'muslo',
    name: 'Muslo de pollo',
    normalizedName: 'muslo de pollo',
    familyId: 'f',
    familyName: 'pollo',
    isSystem: true,
    synonyms: [],
  },
  {
    id: 'tomate',
    name: 'Tomate',
    normalizedName: 'tomate',
    familyId: null,
    familyName: null,
    isSystem: true,
    synonyms: [{ id: 'syn-perita', synonym: 'tomate perita', isSystem: true }],
  },
]

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <IngredientsPanel />
    </QueryClientProvider>,
  )
}

describe('IngredientsPanel', () => {
  beforeEach(() => {
    mockList.mockReset().mockResolvedValue(seed())
    mockCreate.mockClear()
    mockMove.mockClear()
  })

  it('renders canonicals grouped by family with synonym chips', async () => {
    wrap()
    expect(await screen.findByText('Pollo')).toBeInTheDocument()
    expect(screen.getByTestId('ingredients-synonym-syn-pechuga')).toHaveTextContent('pechuga')
    expect(screen.getByText('Tomate')).toBeInTheDocument()
    expect(screen.getByText('tomate perita')).toBeInTheDocument()
  })

  it('filters by search across names and synonyms', async () => {
    wrap()
    await screen.findByText('Pollo')
    fireEvent.change(screen.getByTestId('ingredients-search'), { target: { value: 'perita' } })
    // only Tomate (whose synonym matches) survives
    expect(screen.getByText('Tomate')).toBeInTheDocument()
    expect(screen.queryByText('Pollo')).not.toBeInTheDocument()
  })

  it('creates a canonical', async () => {
    wrap()
    await screen.findByText('Pollo')
    fireEvent.change(screen.getByTestId('ingredients-new-name'), { target: { value: 'Kale' } })
    fireEvent.click(screen.getByTestId('ingredients-new-create'))
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith('Kale'))
  })

  it('moves a synonym to another canonical', async () => {
    wrap()
    await screen.findByText('Pollo')
    // pick the synonym chip → the moving banner appears with move targets
    fireEvent.click(screen.getByTestId('ingredients-synonym-syn-pechuga'))
    expect(screen.getByTestId('ingredients-moving-banner')).toBeInTheDocument()
    // move it onto "Muslo de pollo"
    fireEvent.click(screen.getByTestId('ingredients-move-here-muslo'))
    await waitFor(() => expect(mockMove).toHaveBeenCalledWith('pechuga', 'muslo'))
  })
})
