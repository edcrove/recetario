import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockCreate, mockTaxonomy } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockTaxonomy: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: {
    recipes: {
      create: mockCreate,
      list: vi.fn().mockResolvedValue([]),
    },
    config: { taxonomy: mockTaxonomy },
  },
}))

import { useRouter } from 'expo-router'
import NewRecipeScreen from '../../app/recipe/new'

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('NewRecipeScreen', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    mockTaxonomy.mockReset().mockRejectedValue(new Error('offline'))
  })

  it('renders all required sections (the title lives in the stack header)', () => {
    wrap(<NewRecipeScreen />)
    expect(screen.queryByText('Nueva Receta')).not.toBeInTheDocument()
    expect(screen.getByText('Título *')).toBeInTheDocument()
    expect(screen.getByText('Porciones *')).toBeInTheDocument()
    expect(screen.getByText('Ingredientes *')).toBeInTheDocument()
    expect(screen.getByText('Pasos de preparación')).toBeInTheDocument()
    expect(screen.getByText('Guardar Receta')).toBeInTheDocument()
  })

  it('renders all category buttons', () => {
    wrap(<NewRecipeScreen />)
    for (const cat of ['Desayuno', 'Almuerzo', 'Cena', 'Postre', 'Snack', 'Bebida', 'Otro']) {
      expect(screen.getByText(cat)).toBeInTheDocument()
    }
  })

  it('does not call create when title is empty', () => {
    wrap(<NewRecipeScreen />)
    fireEvent.change(screen.getByPlaceholderText('Nombre de la receta'), { target: { value: '' } })
    fireEvent.click(screen.getByText('Guardar Receta'))
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('does not call create when no ingredients have names', () => {
    wrap(<NewRecipeScreen />)
    fireEvent.change(screen.getByPlaceholderText('Nombre de la receta'), {
      target: { value: 'Test' },
    })
    fireEvent.click(screen.getByText('Guardar Receta'))
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('adds ingredient row when clicking + Agregar ingrediente', () => {
    wrap(<NewRecipeScreen />)
    const before = screen.getAllByPlaceholderText('Ingrediente').length
    fireEvent.click(screen.getByText('+ Agregar ingrediente'))
    expect(screen.getAllByPlaceholderText('Ingrediente').length).toBe(before + 1)
  })

  it('adds step row when clicking + Agregar paso', () => {
    wrap(<NewRecipeScreen />)
    const before = screen.getAllByPlaceholderText(/Paso \d+/).length
    fireEvent.click(screen.getByText('+ Agregar paso'))
    expect(screen.getAllByPlaceholderText(/Paso \d+/).length).toBe(before + 1)
  })

  it('shows servings default as 4', () => {
    wrap(<NewRecipeScreen />)
    expect(screen.getByDisplayValue('4')).toBeInTheDocument()
  })

  it('calls api.recipes.create with trimmed payload on valid submit', async () => {
    mockCreate.mockResolvedValue({ id: 'new-id', title: 'Torta' })
    wrap(<NewRecipeScreen />)

    fireEvent.change(screen.getByPlaceholderText('Nombre de la receta'), {
      target: { value: '  Torta  ' },
    })
    fireEvent.change(screen.getByPlaceholderText('Ingrediente'), { target: { value: 'Harina' } })
    fireEvent.change(screen.getByPlaceholderText('Cant.'), { target: { value: '200' } })
    fireEvent.change(screen.getByPlaceholderText('Paso 1'), { target: { value: 'Mezclar' } })
    fireEvent.click(screen.getByText('Guardar Receta'))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    const payload = mockCreate.mock.calls[0]?.[0]
    expect(payload.title).toBe('Torta')
    expect(payload.servings).toBe(4)
    expect(payload.ingredients[0]?.name).toBe('Harina')
    expect(payload.steps[0]?.text).toBe('Mezclar')
  })

  it('parses servings as integer', async () => {
    mockCreate.mockResolvedValue({ id: 'x' })
    wrap(<NewRecipeScreen />)

    fireEvent.change(screen.getByPlaceholderText('Nombre de la receta'), { target: { value: 'X' } })
    fireEvent.change(screen.getByDisplayValue('4'), { target: { value: '6' } })
    fireEvent.change(screen.getByPlaceholderText('Ingrediente'), { target: { value: 'X' } })
    fireEvent.click(screen.getByText('Guardar Receta'))

    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
    expect(mockCreate.mock.calls[0]?.[0].servings).toBe(6)
  })

  it('filters empty ingredients and steps from payload', async () => {
    mockCreate.mockResolvedValue({ id: 'x' })
    wrap(<NewRecipeScreen />)

    fireEvent.change(screen.getByPlaceholderText('Nombre de la receta'), {
      target: { value: 'Test' },
    })
    fireEvent.change(screen.getByPlaceholderText('Ingrediente'), { target: { value: 'Harina' } })
    fireEvent.click(screen.getByText('+ Agregar ingrediente'))
    fireEvent.click(screen.getByText('Guardar Receta'))

    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
    expect(mockCreate.mock.calls[0]?.[0].ingredients).toHaveLength(1)
  })

  it('submits prep/cook time, computed total, and selected difficulty', async () => {
    mockCreate.mockResolvedValue({ id: 'x' })
    wrap(<NewRecipeScreen />)

    fireEvent.change(screen.getByPlaceholderText('Nombre de la receta'), {
      target: { value: 'Sopa' },
    })
    fireEvent.change(screen.getByPlaceholderText('Ingrediente'), { target: { value: 'Agua' } })
    fireEvent.change(screen.getByTestId('recipe-prep-time'), { target: { value: '10' } })
    fireEvent.change(screen.getByTestId('recipe-cook-time'), { target: { value: '15' } })
    fireEvent.click(screen.getByTestId('difficulty-chip-media'))
    fireEvent.click(screen.getByText('Guardar Receta'))

    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
    const payload = mockCreate.mock.calls[0]?.[0]
    expect(payload.prepTimeMin).toBe(10)
    expect(payload.cookTimeMin).toBe(15)
    expect(payload.totalTimeMin).toBe(25)
    expect(payload.difficulty).toBe('media')
  })

  it('sends null time and difficulty when left untouched', async () => {
    mockCreate.mockResolvedValue({ id: 'x' })
    wrap(<NewRecipeScreen />)

    fireEvent.change(screen.getByPlaceholderText('Nombre de la receta'), { target: { value: 'X' } })
    fireEvent.change(screen.getByPlaceholderText('Ingrediente'), { target: { value: 'Y' } })
    fireEvent.click(screen.getByText('Guardar Receta'))

    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
    const payload = mockCreate.mock.calls[0]?.[0]
    expect(payload.prepTimeMin).toBeNull()
    expect(payload.difficulty).toBeNull()
  })

  it('toggles a difficulty chip off when tapped twice', async () => {
    mockCreate.mockResolvedValue({ id: 'x' })
    wrap(<NewRecipeScreen />)

    fireEvent.change(screen.getByPlaceholderText('Nombre de la receta'), { target: { value: 'X' } })
    fireEvent.change(screen.getByPlaceholderText('Ingrediente'), { target: { value: 'Y' } })
    fireEvent.click(screen.getByTestId('difficulty-chip-fácil'))
    fireEvent.click(screen.getByTestId('difficulty-chip-fácil'))
    fireEvent.click(screen.getByText('Guardar Receta'))

    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
    expect(mockCreate.mock.calls[0]?.[0].difficulty).toBeNull()
  })

  it('opens the new recipe with a saved notice instead of going back', async () => {
    const router = { push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: () => false }
    vi.mocked(useRouter).mockReturnValue(router as never)
    mockCreate.mockResolvedValue({ id: 'new-id' })
    wrap(<NewRecipeScreen />)

    fireEvent.change(screen.getByPlaceholderText('Nombre de la receta'), { target: { value: 'X' } })
    fireEvent.change(screen.getByPlaceholderText('Ingrediente'), { target: { value: 'Y' } })
    fireEvent.click(screen.getByText('Guardar Receta'))

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/recipe/new-id?saved=1'))
    expect(router.back).not.toHaveBeenCalled()
  })

  it('shows the API error and keeps the form', async () => {
    mockCreate.mockRejectedValue(new Error('Sin conexión'))
    wrap(<NewRecipeScreen />)
    fireEvent.change(screen.getByPlaceholderText('Nombre de la receta'), { target: { value: 'X' } })
    fireEvent.change(screen.getByPlaceholderText('Ingrediente'), { target: { value: 'Y' } })
    fireEvent.click(screen.getByText('Guardar Receta'))
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument()
  })

  it('offers every unit with Spanish labels and sends the chosen one', async () => {
    mockCreate.mockResolvedValue({ id: 'x' })
    wrap(<NewRecipeScreen />)
    fireEvent.change(screen.getByPlaceholderText('Nombre de la receta'), { target: { value: 'X' } })
    fireEvent.change(screen.getByPlaceholderText('Ingrediente'), { target: { value: 'Ajo' } })

    expect(screen.queryByTestId('unit-option-0-clove')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('ingredient-unit-0'))
    for (const label of ['cdta', 'cda', 'taza', 'u', 'pizca', 'rodaja', 'diente', 'sin unidad']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    fireEvent.click(screen.getByTestId('unit-option-0-clove'))
    expect(screen.queryByTestId('unit-option-0-clove')).not.toBeInTheDocument()
    expect(screen.getByTestId('ingredient-unit-0')).toHaveTextContent('diente')

    fireEvent.click(screen.getByText('Guardar Receta'))
    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
    expect(mockCreate.mock.calls[0]?.[0].ingredients[0].unit).toBe('clove')
  })

  it('toggles the unit list closed and removes an ingredient row', () => {
    wrap(<NewRecipeScreen />)
    fireEvent.click(screen.getByTestId('ingredient-unit-0'))
    expect(screen.getByTestId('unit-option-0-g')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('ingredient-unit-0'))
    expect(screen.queryByTestId('unit-option-0-g')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('+ Agregar ingrediente'))
    expect(screen.getAllByPlaceholderText('Ingrediente')).toHaveLength(2)
    fireEvent.click(screen.getByTestId('ingredient-remove-1'))
    expect(screen.getAllByPlaceholderText('Ingrediente')).toHaveLength(1)
  })

  it('removes a step row', () => {
    wrap(<NewRecipeScreen />)
    fireEvent.click(screen.getByText('+ Agregar paso'))
    expect(screen.getAllByPlaceholderText(/Paso \d+/)).toHaveLength(2)
    fireEvent.click(screen.getAllByText('✕')[0]!)
    expect(screen.getAllByPlaceholderText(/Paso \d+/)).toHaveLength(1)
  })

  it('sends the chosen diet tags and shows the API reason when they conflict', async () => {
    mockCreate.mockRejectedValue(
      new Error(
        `API 400: ${JSON.stringify({
          error: 'Validation error',
          details: [
            {
              path: 'dietaryTags',
              message:
                'Vegano: "Chorizo" parece no cumplirlo. Quitá la etiqueta o revisá el ingrediente.',
            },
          ],
        })}`,
      ),
    )
    wrap(<NewRecipeScreen />)
    fireEvent.change(screen.getByPlaceholderText('Nombre de la receta'), { target: { value: 'X' } })
    fireEvent.change(screen.getByPlaceholderText('Ingrediente'), { target: { value: 'Chorizo' } })
    fireEvent.click(screen.getByTestId('diet-chip-vegano'))
    fireEvent.click(screen.getByTestId('diet-chip-keto'))
    fireEvent.click(screen.getByTestId('diet-chip-keto'))
    fireEvent.click(screen.getByText('Guardar Receta'))
    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
    expect(mockCreate.mock.calls[0]?.[0].dietaryTags).toEqual(['vegano'])
    // Shown next to the diet chips, not repeated at the bottom of the form
    expect(await screen.findByTestId('recipe-diet-error')).toHaveTextContent(
      'Vegano: "Chorizo" parece no cumplirlo.',
    )
    expect(screen.getAllByText(/parece no cumplirlo/)).toHaveLength(1)
  })

  it("offers the account's own categories and saves the one picked", async () => {
    mockTaxonomy.mockResolvedValue({
      mealCategories: [
        { id: 'c1', name: 'Cena', isSystem: true },
        { id: 'c2', name: 'Comida rápida', isSystem: false },
      ],
      foodTypes: [],
      tags: [],
    })
    mockCreate.mockResolvedValue({ id: 'n' })
    wrap(<NewRecipeScreen />)
    const custom = await screen.findByTestId('recipe-category-Comida rápida')
    expect(screen.getByTestId('recipe-category-Cena')).toHaveAttribute('aria-selected', 'true')
    expect(custom).toHaveAttribute('aria-selected', 'false')
    fireEvent.click(custom)
    expect(custom).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('recipe-category-Cena')).toHaveAttribute('aria-selected', 'false')

    fireEvent.change(screen.getByPlaceholderText('Nombre de la receta'), { target: { value: 'X' } })
    fireEvent.change(screen.getByPlaceholderText('Ingrediente'), { target: { value: 'Pan' } })
    fireEvent.click(screen.getByText('Guardar Receta'))
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(mockCreate.mock.calls[0]?.[0].category).toBe('Comida rápida')
  })

  it('still offers the system categories when the account list fails to load', async () => {
    wrap(<NewRecipeScreen />)
    await waitFor(() => expect(mockTaxonomy).toHaveBeenCalled())
    expect(screen.getAllByTestId(/^recipe-category-/).map((b) => b.textContent)).toEqual([
      'Desayuno',
      'Almuerzo',
      'Cena',
      'Postre',
      'Snack',
      'Bebida',
      'Otro',
    ])
  })

  it('shares the configurator cache, so a category created there is offered at once', async () => {
    mockTaxonomy.mockReturnValue(new Promise(() => {}))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['config-taxonomy'], {
      mealCategories: [{ id: 'c9', name: 'Recién creada', isSystem: false }],
      foodTypes: [],
      tags: [],
    })
    render(
      <QueryClientProvider client={client}>
        <NewRecipeScreen />
      </QueryClientProvider>,
    )
    expect(screen.getByTestId('recipe-category-Recién creada')).toBeInTheDocument()
  })
})
