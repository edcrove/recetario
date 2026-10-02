import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const m = vi.hoisted(() => ({
  mine: vi.fn(),
  create: vi.fn().mockResolvedValue({}),
  invite: vi.fn().mockResolvedValue({}),
  accept: vi.fn().mockResolvedValue({}),
  decline: vi.fn().mockResolvedValue({}),
  removeMember: vi.fn().mockResolvedValue({}),
  changeRole: vi.fn().mockResolvedValue({}),
  leave: vi.fn().mockResolvedValue(undefined),
  confirm: vi.fn(async () => true),
  notify: vi.fn(),
}))

vi.mock('../api/client', () => ({
  api: {
    households: {
      mine: m.mine,
      create: m.create,
      invite: m.invite,
      accept: m.accept,
      decline: m.decline,
      removeMember: m.removeMember,
      changeRole: m.changeRole,
      leave: m.leave,
    },
  },
}))
vi.mock('../providers/AuthProvider', () => ({ useAuth: () => ({ token: 't', userId: 'me' }) }))
vi.mock('../utils/platformAlert', () => ({ confirmAsync: m.confirm, notify: m.notify }))
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }))

import HouseholdScreen from '../../app/household/index'

const member = (userId: string, role: string, extra: Record<string, unknown> = {}) => ({
  userId,
  role,
  acceptedAt: '2026-07-01T00:00:00Z',
  ...extra,
})

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <HouseholdScreen />
    </QueryClientProvider>,
  )
}

describe('HouseholdScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.confirm.mockResolvedValue(true)
  })

  it('without a household offers to create one', async () => {
    m.mine.mockResolvedValue([])
    wrap()
    const input = await screen.findByTestId('household-create-name-input')
    fireEvent.change(input, { target: { value: 'Familia García' } })
    fireEvent.click(screen.getByTestId('household-create-submit'))
    await waitFor(() => expect(m.create.mock.calls[0]?.[0]).toBe('Familia García'))
  })

  it('a pending invitation can be accepted, or declined after confirming', async () => {
    m.mine.mockResolvedValue([
      {
        id: 'h1',
        name: 'Casa',
        members: [
          member('owner-1', 'owner', { displayName: 'Ana' }),
          member('me', 'viewer', { acceptedAt: null }),
        ],
      },
    ])
    wrap()
    expect(await screen.findByTestId('household-invitation-h1')).toHaveTextContent(/Ana te invitó/)
    fireEvent.click(screen.getByTestId('household-accept-h1'))
    await waitFor(() => expect(m.accept.mock.calls[0]?.[0]).toBe('h1'))

    m.confirm.mockResolvedValueOnce(false)
    fireEvent.click(screen.getByTestId('household-decline-h1'))
    await waitFor(() => expect(m.confirm).toHaveBeenCalled())
    expect(m.decline).not.toHaveBeenCalled()
  })

  it('an owner sees members by name and can remove one after confirming', async () => {
    m.mine.mockResolvedValue([
      {
        id: 'h1',
        name: 'Casa',
        members: [member('me', 'owner'), member('u2', 'member', { email: 'beto@x.com' })],
      },
    ])
    wrap()
    expect(await screen.findByText('beto@x.com')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('household-remove-member-u2'))
    await waitFor(() =>
      expect(m.confirm).toHaveBeenCalledWith('Quitar miembro', '¿Quitar a beto@x.com de Casa?'),
    )
    await waitFor(() => expect(m.removeMember).toHaveBeenCalledWith('h1', 'u2'))
    // The owner row never offers removal
    expect(screen.queryByTestId('household-remove-member-me')).toBeNull()
  })

  it('invites by email with the chosen role and reports failures', async () => {
    m.mine.mockResolvedValue([{ id: 'h1', name: 'Casa', members: [member('me', 'owner')] }])
    m.invite.mockRejectedValueOnce(new Error('404'))
    wrap()
    fireEvent.click(await screen.findByTestId('household-invite-open'))
    fireEvent.change(screen.getByTestId('household-invite-email-input'), {
      target: { value: 'nuevo@x.com' },
    })
    fireEvent.click(screen.getByTestId('household-invite-role-viewer'))
    fireEvent.click(screen.getByTestId('household-invite-submit'))
    await waitFor(() => expect(m.invite).toHaveBeenCalledWith('h1', 'nuevo@x.com', 'viewer'))
    await waitFor(() =>
      expect(m.notify).toHaveBeenCalledWith('No se pudo invitar', expect.any(String)),
    )
  })

  it('a plain member cannot manage members', async () => {
    m.mine.mockResolvedValue([
      { id: 'h1', name: 'Casa', members: [member('o', 'owner'), member('me', 'member')] },
    ])
    wrap()
    await screen.findByText(/Casa/)
    expect(screen.queryByTestId('household-invite-open')).toBeNull()
    expect(screen.queryByTestId('household-remove-member-o')).toBeNull()
  })
})

// Story "App: gestión de household (invitar, roles)": "Owner puede cambiar rol
// o remover miembro. Miembro puede ver y abandonar el hogar."
describe('HouseholdScreen: change role and leave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.confirm.mockResolvedValue(true)
  })

  const ownerView = () =>
    m.mine.mockResolvedValue([
      {
        id: 'h1',
        name: 'Casa',
        members: [
          member('me', 'owner'),
          member('ana', 'member', { displayName: 'Ana' }),
          member('beto', 'viewer', { displayName: 'Beto' }),
        ],
      },
    ])

  it("the owner opens a member's role picker with the current role marked", async () => {
    ownerView()
    wrap()
    fireEvent.click(await screen.findByTestId('household-change-role-ana'))
    expect(screen.getByTestId('household-role-picker-ana')).toBeInTheDocument()
    // The current role is marked and can't be re-picked; the others can
    expect(screen.getByTestId('household-role-option-ana-member')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByTestId('household-role-option-ana-viewer')).toHaveAttribute(
      'aria-selected',
      'false',
    )
    expect(screen.getByTestId('household-role-option-ana-member')).toBeDisabled()
    expect(screen.getByTestId('household-role-option-ana-viewer')).not.toBeDisabled()
    expect(screen.getByTestId('household-role-option-ana-admin')).not.toBeDisabled()
    // Only that member's picker is open
    expect(screen.queryByTestId('household-role-picker-beto')).toBeNull()
  })

  it('each role button is labelled with the member it changes', async () => {
    ownerView()
    wrap()
    expect(await screen.findByLabelText('Cambiar el rol de Ana')).toHaveAttribute(
      'data-testid',
      'household-change-role-ana',
    )
    expect(screen.getByLabelText('Cambiar el rol de Beto')).toBeInTheDocument()
  })

  it('a household returned without a member list still renders (no leave button)', async () => {
    m.mine.mockResolvedValue([{ id: 'h1', name: 'Casa vacía' }])
    wrap()
    expect(await screen.findByText(/Casa vacía/)).toBeInTheDocument()
    expect(screen.queryByTestId('household-leave-h1')).toBeNull()
  })

  it('picking a role changes it for that member and closes the picker', async () => {
    ownerView()
    wrap()
    fireEvent.click(await screen.findByTestId('household-change-role-ana'))
    fireEvent.click(screen.getByTestId('household-role-option-ana-viewer'))
    await waitFor(() => expect(m.changeRole).toHaveBeenCalledWith('h1', 'ana', 'viewer'))
    await waitFor(() => expect(screen.queryByTestId('household-role-picker-ana')).toBeNull())
    // The list is refetched so the new badge shows
    expect(m.mine.mock.calls.length).toBeGreaterThan(1)
  })

  it('tapping "Rol" again closes the picker without changing anything', async () => {
    ownerView()
    wrap()
    fireEvent.click(await screen.findByTestId('household-change-role-ana'))
    fireEvent.click(screen.getByTestId('household-change-role-ana'))
    expect(screen.queryByTestId('household-role-picker-ana')).toBeNull()
    expect(m.changeRole).not.toHaveBeenCalled()
  })

  it('a failed role change is reported', async () => {
    ownerView()
    m.changeRole.mockRejectedValueOnce(new Error('API 403'))
    wrap()
    fireEvent.click(await screen.findByTestId('household-change-role-ana'))
    fireEvent.click(screen.getByTestId('household-role-option-ana-admin'))
    await waitFor(() =>
      expect(m.notify).toHaveBeenCalledWith('Error', 'No se pudo cambiar el rol. Probá de nuevo.'),
    )
  })

  it("nobody gets a role control on the owner's row, and the owner has no leave button", async () => {
    ownerView()
    wrap()
    await screen.findByTestId('household-change-role-ana')
    expect(screen.queryByTestId('household-change-role-me')).toBeNull()
    expect(screen.queryByTestId('household-leave-h1')).toBeNull()
  })

  it('a plain member sees no role controls', async () => {
    m.mine.mockResolvedValue([
      {
        id: 'h1',
        name: 'Casa',
        members: [member('o', 'owner'), member('me', 'member'), member('x', 'viewer')],
      },
    ])
    wrap()
    await screen.findByText(/Casa/)
    expect(screen.queryByTestId('household-change-role-x')).toBeNull()
    expect(screen.queryByTestId('household-change-role-me')).toBeNull()
  })

  it('a member leaves after confirming, and every shared screen is refreshed', async () => {
    m.mine.mockResolvedValue([
      { id: 'h1', name: 'Casa', members: [member('o', 'owner'), member('me', 'member')] },
    ])
    wrap()
    fireEvent.click(await screen.findByTestId('household-leave-h1'))
    await waitFor(() => expect(m.leave).toHaveBeenCalledWith('h1'))
    expect(m.confirm).toHaveBeenCalledWith(
      'Abandonar hogar',
      '¿Abandonar Casa? Vas a dejar de ver sus recetas, el menú semanal y la lista de compras.',
    )
    await waitFor(() => expect(m.mine.mock.calls.length).toBeGreaterThan(1))
  })

  it('cancelling the confirmation keeps them in the household', async () => {
    m.mine.mockResolvedValue([
      { id: 'h1', name: 'Casa', members: [member('o', 'owner'), member('me', 'viewer')] },
    ])
    m.confirm.mockResolvedValueOnce(false)
    wrap()
    fireEvent.click(await screen.findByTestId('household-leave-h1'))
    await waitFor(() => expect(m.confirm).toHaveBeenCalled())
    expect(m.leave).not.toHaveBeenCalled()
  })

  it('a failed leave is reported', async () => {
    m.mine.mockResolvedValue([
      { id: 'h1', name: 'Casa', members: [member('o', 'owner'), member('me', 'admin')] },
    ])
    m.leave.mockRejectedValueOnce(new Error('API 500'))
    wrap()
    fireEvent.click(await screen.findByTestId('household-leave-h1'))
    await waitFor(() =>
      expect(m.notify).toHaveBeenCalledWith(
        'Error',
        'No se pudo abandonar el hogar. Probá de nuevo.',
      ),
    )
  })
})

// 2026-10-02 review: a failed load read as "no household yet" and offered to
// create a second one
describe('HouseholdScreen load error', () => {
  it('says the household could not load instead of offering to create one', async () => {
    m.mine.mockReset().mockRejectedValueOnce(new Error('boom')).mockResolvedValue([])
    wrap()
    expect(await screen.findByText('No se pudo cargar tu hogar.')).toBeInTheDocument()
    expect(m.create).not.toHaveBeenCalled()
    expect(screen.queryByPlaceholderText(/nombre/i)).toBeNull()
    fireEvent.click(screen.getByTestId('error-retry'))
    await waitFor(() => expect(m.mine).toHaveBeenCalledTimes(2))
  })
})
