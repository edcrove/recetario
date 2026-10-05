import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const m = vi.hoisted(() => ({
  addDiner: vi.fn(),
  updateDiner: vi.fn(),
  removeDiner: vi.fn(),
  confirm: vi.fn(async () => true),
  notify: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: {
    households: { addDiner: m.addDiner, updateDiner: m.updateDiner, removeDiner: m.removeDiner },
  },
}))
vi.mock('../utils/platformAlert', () => ({ confirmAsync: m.confirm, notify: m.notify }))

import { HouseholdDiners } from '../components/HouseholdDiners'

const HH = 'h1'
const sofi = {
  id: 'd1',
  householdId: HH,
  name: 'Sofi',
  allergens: ['mani'],
  dietaryRestrictions: ['vegetariano', 'legacy'],
}

function wrap(canEdit = true, diners = [sofi]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <HouseholdDiners householdId={HH} diners={diners} canEdit={canEdit} />
    </QueryClientProvider>,
  )
}

// Story (Auditar 2026-10-03): a kid without an account, recorded once for
// the household.
describe('HouseholdDiners', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.confirm.mockResolvedValue(true)
  })

  it('lists each diner with their restrictions, in Spanish', () => {
    wrap(true, [sofi, { ...sofi, id: 'd2', name: 'Abu', allergens: [], dietaryRestrictions: [] }])
    expect(screen.getByTestId('household-diner-d1')).toHaveTextContent(
      'SofiManí, Vegetariano, legacy',
    )
    expect(screen.getByTestId('household-diner-d2')).toHaveTextContent('Sin restricciones')
  })

  it('adds a kid with allergies and a diet', async () => {
    m.addDiner.mockResolvedValue({})
    wrap(true, [])
    fireEvent.click(screen.getByTestId(`household-diner-add-${HH}`))
    expect(screen.getByTestId('household-diner-save')).toBeDisabled()
    fireEvent.change(screen.getByTestId('household-diner-name'), { target: { value: ' Juan ' } })
    fireEvent.click(screen.getByTestId('household-diner-allergen-gluten'))
    fireEvent.click(screen.getByTestId('household-diner-allergen-huevo'))
    fireEvent.click(screen.getByTestId('household-diner-allergen-huevo'))
    fireEvent.click(screen.getByTestId('household-diner-diet-vegano'))
    fireEvent.click(screen.getByTestId('household-diner-save'))
    await waitFor(() =>
      expect(m.addDiner).toHaveBeenCalledWith(HH, {
        name: 'Juan',
        allergens: ['gluten'],
        dietaryRestrictions: ['vegano'],
      }),
    )
    await waitFor(() => expect(screen.queryByTestId('household-diner-form')).toBeNull())
  })

  it('edits one, keeping only known diets, and can cancel', async () => {
    m.updateDiner.mockResolvedValue({})
    wrap()
    fireEvent.click(screen.getByTestId('household-diner-edit-d1'))
    expect(screen.getByTestId('household-diner-name')).toHaveValue('Sofi')
    fireEvent.click(screen.getByTestId('household-diner-diet-vegetariano'))
    fireEvent.click(screen.getByTestId('household-diner-save'))
    await waitFor(() =>
      expect(m.updateDiner).toHaveBeenCalledWith(HH, 'd1', {
        name: 'Sofi',
        allergens: ['mani'],
        dietaryRestrictions: [],
      }),
    )
    fireEvent.click(screen.getByTestId('household-diner-edit-d1'))
    fireEvent.click(screen.getByTestId('household-diner-cancel'))
    expect(screen.queryByTestId('household-diner-form')).toBeNull()
  })

  it('asks before removing one', async () => {
    m.removeDiner.mockResolvedValue(undefined)
    wrap()
    m.confirm.mockResolvedValueOnce(false)
    fireEvent.click(screen.getByTestId('household-diner-remove-d1'))
    await waitFor(() => expect(m.confirm).toHaveBeenCalled())
    expect(m.removeDiner).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('household-diner-remove-d1'))
    await waitFor(() => expect(m.removeDiner).toHaveBeenCalledWith(HH, 'd1'))
  })

  it('says when saving or removing fails', async () => {
    m.addDiner.mockRejectedValue(new Error('API 500'))
    m.removeDiner.mockRejectedValue(new Error('API 500'))
    wrap()
    fireEvent.click(screen.getByTestId(`household-diner-add-${HH}`))
    fireEvent.change(screen.getByTestId('household-diner-name'), { target: { value: 'Juan' } })
    fireEvent.click(screen.getByTestId('household-diner-save'))
    await waitFor(() => expect(m.notify).toHaveBeenCalledWith('Error', expect.any(String)))
    fireEvent.click(screen.getByTestId('household-diner-remove-d1'))
    await waitFor(() => expect(m.notify).toHaveBeenCalledTimes(2))
  })

  it('a viewer reads the list but cannot change it', () => {
    wrap(false)
    expect(screen.getByTestId('household-diner-d1')).toBeInTheDocument()
    expect(screen.queryByTestId('household-diner-edit-d1')).toBeNull()
    expect(screen.queryByTestId('household-diner-remove-d1')).toBeNull()
    expect(screen.queryByTestId(`household-diner-add-${HH}`)).toBeNull()
  })
})
