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
