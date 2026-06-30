import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))

vi.mock('../api/client', () => ({
  api: {
    recipes: {
      create: mockCreate,
      list: vi.fn().mockResolvedValue([]),
    },
  },
}))

import NewRecipeScreen from '../../app/recipe/new'

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('NewRecipeScreen', () => {
  beforeEach(() => mockCreate.mockReset())

  it('renders form heading and all required sections', () => {
    wrap(<NewRecipeScreen />)
    expect(screen.getByText('Nueva Receta')).toBeInTheDocument()
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
})
