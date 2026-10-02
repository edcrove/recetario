import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockLibrary } = vi.hoisted(() => ({ mockLibrary: vi.fn() }))

vi.mock('../api/client', () => ({
  api: { library: { list: mockLibrary }, recipes: { copy: vi.fn() } },
}))
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../utils/platformAlert', () => ({ notify: vi.fn(), confirmAsync: vi.fn() }))

import LibraryScreen from '../../app/library/index'

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <LibraryScreen />
    </QueryClientProvider>,
  )
}

const pub = (id: string) =>
  ({ id, title: `Receta ${id}`, category: 'Cena', servings: 2, tags: [], author: 'Ana' }) as never

describe('LibraryScreen', () => {
  beforeEach(() => mockLibrary.mockReset())

  // 2026-10-02 review: the library asked for one page (the API's default 30), so
  // older public recipes could only be found by searching for them.
  it('lists public recipes past the first page, and searches through every page too', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => pub(`p${i}`))
    mockLibrary.mockResolvedValueOnce(page1).mockResolvedValueOnce([pub('old')])
    wrap()
    expect(await screen.findByTestId('library-recipe-old')).toBeInTheDocument()
    expect(mockLibrary.mock.calls.map((c) => c[0])).toEqual([
      { limit: 100, offset: 0 },
      { limit: 100, offset: 100 },
    ])
    mockLibrary.mockResolvedValue([])
    fireEvent.change(screen.getByTestId('library-search'), { target: { value: 'pan' } })
    await waitFor(() =>
      expect(mockLibrary).toHaveBeenLastCalledWith({ search: 'pan', limit: 100, offset: 0 }),
    )
  })

  // 2026-10-02 review: a failed load read as "La biblioteca está vacía"
  it('says the library could not load, and retries', async () => {
    mockLibrary.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([])
    wrap()
    expect(await screen.findByText('No se pudo cargar la biblioteca.')).toBeInTheDocument()
    expect(screen.queryByText('La biblioteca está vacía')).toBeNull()
    fireEvent.click(screen.getByTestId('error-retry'))
    expect(await screen.findByText('La biblioteca está vacía')).toBeInTheDocument()
  })
})
