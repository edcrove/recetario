import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockUpdate } = vi.hoisted(() => ({ mockUpdate: vi.fn() }))

vi.mock('../api/client', () => ({
  api: {
    recipes: {
      get: vi.fn().mockResolvedValue({
        id: 'edit-id',
        title: 'Receta Original',
        servings: 2,
        category: 'Postre',
        tags: ['dulce'],
        images: [],
        originalLanguage: 'es',
        translations: [],
        notes: 'Muy rica',
        ingredients: [{ name: 'Azúcar', quantity: 100, unit: 'g' }],
        steps: [{ text: 'Caramelizar' }],
      }),
      update: mockUpdate,
    },
  },
}))

import EditRecipeScreen from '../../app/recipe/[id]/edit'

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('EditRecipeScreen', () => {
  beforeEach(() => mockUpdate.mockReset())

  it('renders the edit screen heading', () => {
    wrap(<EditRecipeScreen />)
    expect(screen.getByText('Editar Receta')).toBeInTheDocument()
  })

  it('populates title from loaded recipe', async () => {
    wrap(<EditRecipeScreen />)
    expect(await screen.findByDisplayValue('Receta Original')).toBeInTheDocument()
  })

  it('populates servings from loaded recipe', async () => {
    wrap(<EditRecipeScreen />)
    expect(await screen.findByDisplayValue('2')).toBeInTheDocument()
  })

  it('populates ingredient name from loaded recipe', async () => {
    wrap(<EditRecipeScreen />)
    expect(await screen.findByDisplayValue('Azúcar')).toBeInTheDocument()
  })

  it('populates ingredient quantity from loaded recipe', async () => {
    wrap(<EditRecipeScreen />)
    expect(await screen.findByDisplayValue('100')).toBeInTheDocument()
  })

  it('populates step text from loaded recipe', async () => {
    wrap(<EditRecipeScreen />)
    expect(await screen.findByDisplayValue('Caramelizar')).toBeInTheDocument()
  })

  it('populates notes from loaded recipe', async () => {
    wrap(<EditRecipeScreen />)
    expect(await screen.findByDisplayValue('Muy rica')).toBeInTheDocument()
  })

  it('shows Guardar Cambios button', async () => {
    wrap(<EditRecipeScreen />)
    expect(await screen.findByText('Guardar Cambios')).toBeInTheDocument()
  })

  it('calls api.recipes.update with correct id on submit', async () => {
    mockUpdate.mockResolvedValue({})
    wrap(<EditRecipeScreen />)
    await screen.findByDisplayValue('Receta Original')
    fireEvent.click(screen.getByText('Guardar Cambios'))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        'test-recipe-id',
        expect.objectContaining({ title: 'Receta Original' }),
      ),
    )
  })

  it('user can change title and submit updated value', async () => {
    mockUpdate.mockResolvedValue({})
    wrap(<EditRecipeScreen />)

    const titleInput = await screen.findByDisplayValue('Receta Original')
    fireEvent.change(titleInput, { target: { value: 'Receta Editada' } })
    fireEvent.click(screen.getByText('Guardar Cambios'))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        'test-recipe-id',
        expect.objectContaining({ title: 'Receta Editada' }),
      ),
    )
  })

  it('shows all category buttons after load', async () => {
    wrap(<EditRecipeScreen />)
    await screen.findByDisplayValue('Receta Original')
    expect(screen.getByText('Postre')).toBeInTheDocument()
    expect(screen.getByText('Cena')).toBeInTheDocument()
  })
})
