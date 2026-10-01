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
