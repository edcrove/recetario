import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
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

// 2026-10-02 review: a failed load read as "La biblioteca está vacía"
describe('LibraryScreen', () => {
  it('says the library could not load, and retries', async () => {
    mockLibrary.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([])
    wrap()
    expect(await screen.findByText('No se pudo cargar la biblioteca.')).toBeInTheDocument()
    expect(screen.queryByText('La biblioteca está vacía')).toBeNull()
    fireEvent.click(screen.getByTestId('error-retry'))
    expect(await screen.findByText('La biblioteca está vacía')).toBeInTheDocument()
  })
})
