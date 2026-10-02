import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const m = vi.hoisted(() => ({
  taxonomy: vi.fn(),
  rename: vi.fn().mockResolvedValue({}),
  del: vi.fn().mockResolvedValue({}),
  merge: vi.fn().mockResolvedValue({}),
  create: vi.fn().mockResolvedValue({}),
  usedBy: vi.fn(),
  push: vi.fn(),
  notify: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: {
    config: {
      taxonomy: m.taxonomy,
      rename: m.rename,
      delete: m.del,
      mergeTags: m.merge,
      create: m.create,
      usedBy: m.usedBy,
    },
  },
}))
vi.mock('expo-router', () => ({ useRouter: () => ({ push: m.push }) }))
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

  // 2026-10-02 review: a rename the API refused (e.g. onto a built-in name)
  // failed silently — the edit just stayed open
  it('says when the new name is already on the list', async () => {
    m.rename.mockRejectedValueOnce(new Error('API 409: {"error":"Already exists"}'))
    wrap()
    fireEvent.click(await screen.findByTestId('config-edit-c2'))
    fireEvent.change(screen.getByPlaceholderText('Nuevo nombre'), { target: { value: ' Cena ' } })
    fireEvent.click(screen.getByTestId('config-rename-save'))
    await waitFor(() =>
      expect(m.notify).toHaveBeenCalledWith('Ya existe', '"Cena" ya está en la lista.'),
    )
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

  it('reports a failed tag merge', async () => {
    m.merge.mockRejectedValueOnce(new Error('API 500'))
    wrap()
    fireEvent.click(await screen.findByTestId('config-tab-tags'))
    fireEvent.click(await screen.findByTestId('config-delete-t2'))
    fireEvent.click(screen.getByTestId('config-reassign-t1'))
    fireEvent.click(screen.getByTestId('config-delete-confirm'))
    await waitFor(() =>
      expect(m.notify).toHaveBeenCalledWith('Error', 'No se pudieron unir las etiquetas.'),
    )
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

  describe('create an item per tab', () => {
    it.each([
      ['categories', 'Nueva categoría'],
      ['food-types', 'Nuevo tipo de comida'],
      ['tags', 'Nueva etiqueta'],
    ] as const)('creates a %s item with the trimmed name and clears the input', async (tab, ph) => {
      wrap()
      fireEvent.click(await screen.findByTestId(`config-tab-${tab}`))
      const input = screen.getByTestId('config-new-name')
      expect(input).toHaveAttribute('placeholder', ph)
      fireEvent.change(input, { target: { value: '  Merienda  ' } })
      fireEvent.click(screen.getByTestId('config-new-add'))
      await waitFor(() => expect(m.create).toHaveBeenCalledWith(tab, 'Merienda'))
      await waitFor(() => expect(screen.getByTestId('config-new-name')).toHaveValue(''))
      // the list is re-fetched so the new item shows up
      await waitFor(() => expect(m.taxonomy).toHaveBeenCalledTimes(2))
    })

    it('the add button is disabled while the name is blank', async () => {
      wrap()
      const add = await screen.findByTestId('config-new-add')
      expect(add).toBeDisabled()
      fireEvent.change(screen.getByTestId('config-new-name'), { target: { value: '   ' } })
      expect(add).toBeDisabled()
      fireEvent.change(screen.getByTestId('config-new-name'), { target: { value: 'x' } })
      expect(add).toBeEnabled()
    })

    it('says "Ya existe" on a duplicate and keeps what was typed', async () => {
      m.create.mockRejectedValueOnce(new Error('API 409: {"error":"Already exists"}'))
      wrap()
      fireEvent.change(await screen.findByTestId('config-new-name'), { target: { value: 'Cena' } })
      fireEvent.click(screen.getByTestId('config-new-add'))
      await waitFor(() =>
        expect(m.notify).toHaveBeenCalledWith('Ya existe', '"Cena" ya está en la lista.'),
      )
      expect(screen.getByTestId('config-new-name')).toHaveValue('Cena')
    })

    it('the ingredients tab has no create row (it has its own panel)', async () => {
      wrap()
      fireEvent.click(await screen.findByTestId('config-tab-ingredients'))
      await screen.findByTestId('ingredients-panel')
      expect(screen.queryByTestId('config-new-name')).toBeNull()
    })
  })

  describe('usage badge → recipes', () => {
    it('tapping a badge lists the recipes that use the item, and each opens the recipe', async () => {
      m.usedBy.mockResolvedValueOnce([
        { id: 'r1', title: 'Guiso de lentejas' },
        { id: 'r2', title: 'Tarta' },
      ])
      wrap()
      fireEvent.click(await screen.findByTestId('config-tab-food-types'))
      const badge = await screen.findByTestId('config-usage-f1')
      expect(badge).toHaveTextContent(/^1 receta$/)
      expect(badge.getAttribute('accessibilityLabel')).toBe('Ver 1 receta con "Guiso"')
      fireEvent.click(badge)
      expect(screen.getByText('Recetas con "Guiso"')).toBeInTheDocument()
      expect(m.usedBy).toHaveBeenCalledWith('food-types', 'f1')
      expect(await screen.findByText('Guiso de lentejas')).toBeInTheDocument()
      expect(screen.getByTestId('config-usage-recipe-r2')).toHaveTextContent('Tarta')
      fireEvent.click(screen.getByTestId('config-usage-recipe-r1'))
      expect(m.push).toHaveBeenCalledWith({ pathname: '/recipe/[id]', params: { id: 'r1' } })
      expect(screen.queryByText('Recetas con "Guiso"')).toBeNull()
    })

    it('shows a spinner while loading and closes with Cerrar', async () => {
      let resolve: (v: unknown) => void = () => {}
      m.usedBy.mockReturnValueOnce(new Promise((r) => (resolve = r)))
      wrap()
      fireEvent.click(await screen.findByTestId('config-usage-c1'))
      expect(screen.queryByTestId('config-usage-recipe-r9')).toBeNull()
      resolve([{ id: 'r9', title: 'Sopa' }])
      expect(await screen.findByTestId('config-usage-recipe-r9')).toBeInTheDocument()
      fireEvent.click(screen.getByTestId('config-usage-close'))
      expect(screen.queryByText('Recetas con "Cena"')).toBeNull()
      expect(m.push).not.toHaveBeenCalled()
    })

    it("each badge shows its own item's recipes, never the previous list", async () => {
      m.usedBy
        .mockResolvedValueOnce([{ id: 'r9', title: 'Sopa' }])
        .mockReturnValueOnce(new Promise(() => {}))
      wrap()
      fireEvent.click(await screen.findByTestId('config-usage-c1'))
      expect(await screen.findByText('Sopa')).toBeInTheDocument()
      expect(screen.getByTestId('config-usage-c1')).toHaveTextContent(/^3 recetas$/)
      fireEvent.click(screen.getByTestId('config-usage-close'))
      fireEvent.click(screen.getByTestId('config-tab-tags'))
      fireEvent.click(await screen.findByTestId('config-usage-t1'))
      expect(m.usedBy).toHaveBeenLastCalledWith('tags', 't1')
      expect(screen.getByText('Recetas con "rapido"')).toBeInTheDocument()
      expect(screen.queryByText('Sopa')).toBeNull()
    })

    it('says so when the list fails to load', async () => {
      m.usedBy.mockRejectedValueOnce(new Error('API 500: {}'))
      wrap()
      fireEvent.click(await screen.findByTestId('config-usage-c1'))
      expect(await screen.findByText('No se pudieron cargar las recetas.')).toBeInTheDocument()
      expect(document.querySelector('[data-testid^="config-usage-recipe-"]')).toBeNull()
    })

    it('an unused item has a disabled badge that fetches nothing', async () => {
      wrap()
      const badge = await screen.findByTestId('config-usage-c2')
      expect(badge).toHaveTextContent(/^0 recetas$/)
      expect(badge).toBeDisabled()
      fireEvent.click(badge)
      expect(m.usedBy).not.toHaveBeenCalled()
      expect(screen.queryByText('Recetas con "Brunch"')).toBeNull()
    })
  })
})
