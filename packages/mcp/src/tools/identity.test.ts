import { describe, it, expect, vi } from 'vitest'
import { createMcpServer } from '../index.js'
import { registerIdentityTools } from './identity.js'

const mockRequest = vi.fn()
const mockApi = { request: mockRequest }

describe('registerIdentityTools', () => {
  it('registers whoami, updateProfile, listHouseholdMembers tools', () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerIdentityTools(server, mockApi as never)
    const names = spy.mock.calls.map((c: unknown[]) => c[0])
    expect(names).toContain('whoami')
    expect(names).toContain('updateProfile')
    expect(names).toContain('listHouseholdMembers')
    expect(names).toContain('respondToHouseholdInvitation')
  })
})

// Helper: get the last argument of a tool call (always the handler)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHandler(spy: any, name: string) {
  const call = spy.mock.calls.find((c: unknown[]) => c[0] === name)
  return call?.[call.length - 1] as (...args: unknown[]) => Promise<unknown>
}

describe('whoami', () => {
  it('calls /auth/me and /auth/profile and returns combined result', async () => {
    const server = createMcpServer()
    const spy = vi.spyOn(server, 'tool')
    registerIdentityTools(server, mockApi as never)

    mockRequest
      .mockResolvedValueOnce({ id: 'u1', email: 'a@a.com', displayName: 'Alice' })
      .mockResolvedValueOnce({ preferredServings: 2, dietaryRestrictions: [], allergens: [] })

    const result = await getHandler(spy, 'whoami')()
    expect(JSON.stringify(result)).toContain('Alice')
    expect(JSON.stringify(result)).toContain('preferredServings')
  })

  it('still returns the user when /auth/profile fails', async () => {
    const server = createMcpServer()
    const spy = vi.spyOn(server, 'tool')
    registerIdentityTools(server, mockApi as never)

    mockRequest
      .mockResolvedValueOnce({ id: 'u1', email: 'a@a.com', displayName: 'Alice' })
      .mockRejectedValueOnce(new Error('404'))

    const result = await getHandler(spy, 'whoami')()
    expect(JSON.stringify(result)).toContain('Alice')
    expect(JSON.stringify(result)).not.toContain('preferredServings')
  })
})

describe('updateProfile', () => {
  it('calls PATCH /auth/profile with args', async () => {
    const server = createMcpServer()
    const spy = vi.spyOn(server, 'tool')
    registerIdentityTools(server, mockApi as never)

    mockRequest.mockResolvedValueOnce({
      preferredServings: 4,
      dietaryRestrictions: ['vegano'],
      allergens: [],
      goals: [],
      timezone: null,
    })

    const result = await getHandler(
      spy,
      'updateProfile',
    )({ preferredServings: 4, dietaryRestrictions: ['vegano'] })
    expect(JSON.stringify(result)).toContain('preferredServings')
    expect(mockRequest).toHaveBeenCalledWith(
      '/auth/profile',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })
})

describe('listHouseholdMembers', () => {
  it('calls GET /v1/households/mine', async () => {
    const server = createMcpServer()
    const spy = vi.spyOn(server, 'tool')
    registerIdentityTools(server, mockApi as never)

    mockRequest.mockResolvedValueOnce([{ id: 'hh1', name: 'Mi Hogar', members: [] }])

    const result = await getHandler(spy, 'listHouseholdMembers')()
    expect(JSON.stringify(result)).toContain('Mi Hogar')
    expect(mockRequest).toHaveBeenCalledWith('/v1/households/mine')
  })
})

describe('respondToHouseholdInvitation', () => {
  const HH = '550e8400-e29b-41d4-a716-446655440000'

  it('accept=true posts to /accept and returns the membership', async () => {
    const server = createMcpServer()
    const spy = vi.spyOn(server, 'tool')
    registerIdentityTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce({ userId: 'u', role: 'member', acceptedAt: '2026-10-01' })

    const result = await getHandler(
      spy,
      'respondToHouseholdInvitation',
    )({ householdId: HH, accept: true })
    expect(mockRequest).toHaveBeenCalledWith(`/v1/households/${HH}/accept`, { method: 'POST' })
    expect(JSON.stringify(result)).toContain('2026-10-01')
  })

  it('accept=false posts to /decline', async () => {
    const server = createMcpServer()
    const spy = vi.spyOn(server, 'tool')
    registerIdentityTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce(null)

    const result = await getHandler(
      spy,
      'respondToHouseholdInvitation',
    )({ householdId: HH, accept: false })
    expect(mockRequest).toHaveBeenCalledWith(`/v1/households/${HH}/decline`, { method: 'POST' })
    expect(JSON.stringify(result)).toContain('declined')
  })
})
