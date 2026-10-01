import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const m = vi.hoisted(() => ({
  taxonomy: vi.fn(),
  rename: vi.fn().mockResolvedValue({}),
  del: vi.fn().mockResolvedValue({}),
  merge: vi.fn().mockResolvedValue({}),
  notify: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: {
    config: { taxonomy: m.taxonomy, rename: m.rename, delete: m.del, mergeTags: m.merge },
  },
}))
vi.mock('../utils/platformAlert', () => ({ notify: m.notify, confirmAsync: vi.fn() }))
vi.mock('../components/IngredientsPanel', () => ({
  IngredientsPanel: () => <div data-testid="ingredients-panel" />,
}))

import ConfiguratorScreen from '../../app/config/index'

const item = (id: string, name: string, usageCount: number, isDeletable = usageCount === 0) => ({
  id,
  name,
  usageCount,
  isDeletable,
})

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ConfiguratorScreen />
    </QueryClientProvider>,
  )
}

describe('ConfiguratorScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.taxonomy.mockResolvedValue({
      mealCategories: [item('c1', 'Cena', 3), item('c2', 'Brunch', 0)],
      foodTypes: [item('f1', 'Guiso', 1)],
      tags: [item('t1', 'rapido', 2), item('t2', 'rápido', 1)],
    })
  })

  it('renames an item', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('config-edit-c1'))
    fireEvent.change(screen.getByPlaceholderText('Nuevo nombre'), { target: { value: 'Cenas' } })
    fireEvent.click(screen.getByTestId('config-rename-save'))
    await waitFor(() => expect(m.rename).toHaveBeenCalledWith('categories', 'c1', 'Cenas'))
  })

  it('deletes an unused item directly', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('config-delete-c2'))
    fireEvent.click(screen.getByTestId('config-delete-confirm'))
    await waitFor(() => expect(m.del).toHaveBeenCalledWith('categories', 'c2', undefined))
  })

  it('reassigns a used category before deleting it', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('config-delete-c1'))
    fireEvent.click(screen.getByTestId('config-reassign-c2'))
    expect(screen.getByText('Reasignar y eliminar')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('config-delete-confirm'))
    await waitFor(() => expect(m.del).toHaveBeenCalledWith('categories', 'c1', 'c2'))
  })

  it('merges a tag into another instead of deleting', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('config-tab-tags'))
    fireEvent.click(await screen.findByTestId('config-delete-t2'))
    fireEvent.click(screen.getByTestId('config-reassign-t1'))
    fireEvent.click(screen.getByTestId('config-delete-confirm'))
    await waitFor(() => expect(m.merge).toHaveBeenCalledWith('t2', 't1'))
  })

  it('reports a failed delete and keeps the modal open', async () => {
    m.del.mockRejectedValueOnce(new Error('boom'))
    wrap()
    fireEvent.click(await screen.findByTestId('config-delete-c2'))
    fireEvent.click(screen.getByTestId('config-delete-confirm'))
    await waitFor(() =>
      expect(m.notify).toHaveBeenCalledWith('Error', 'No se pudo eliminar el elemento.'),
    )
    expect(screen.getByTestId('config-delete-confirm')).toBeInTheDocument()
  })

  it('the ingredients tab shows the catalog panel', async () => {
    wrap()
    fireEvent.click(await screen.findByTestId('config-tab-ingredients'))
    expect(await screen.findByTestId('ingredients-panel')).toBeInTheDocument()
  })
})
