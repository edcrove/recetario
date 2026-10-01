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
    expect(names).toContain('changeHouseholdMemberRole')
    expect(names).toContain('leaveHousehold')
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

describe('changeHouseholdMemberRole', () => {
  const HH = '550e8400-e29b-41d4-a716-446655440000'
  const U = '550e8400-e29b-41d4-a716-446655440001'

  it('PATCHes the member with the new role and returns the API member', async () => {
    const server = createMcpServer()
    const spy = vi.spyOn(server, 'tool')
    registerIdentityTools(server, mockApi as never)
    mockRequest.mockReset().mockResolvedValueOnce({ userId: U, role: 'viewer' })

    const result = (await getHandler(
      spy,
      'changeHouseholdMemberRole',
    )({
      householdId: HH,
      userId: U,
      role: 'viewer',
    })) as { content: { text: string }[] }
    expect(mockRequest).toHaveBeenCalledWith(`/v1/households/${HH}/members/${U}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'viewer' }),
    })
    expect(JSON.parse(result.content[0]!.text)).toEqual({ userId: U, role: 'viewer' })
  })

  it('only offers non-owner roles to the agent', () => {
    const server = createMcpServer()
    const spy = vi.spyOn(server, 'tool')
    registerIdentityTools(server, mockApi as never)
    const call = spy.mock.calls.find((c: unknown[]) => c[0] === 'changeHouseholdMemberRole')!
    const shape = call[2] as unknown as {
      role: { safeParse: (v: unknown) => { success: boolean } }
    }
    expect(shape.role.safeParse('owner').success).toBe(false)
    for (const r of ['admin', 'member', 'viewer'])
      expect(shape.role.safeParse(r).success).toBe(true)
  })

  it('surfaces API errors (e.g. 403 for a plain member) to the agent', async () => {
    const server = createMcpServer()
    const spy = vi.spyOn(server, 'tool')
    registerIdentityTools(server, mockApi as never)
    mockRequest.mockReset().mockRejectedValueOnce(new Error('API 403: Forbidden'))
    await expect(
      getHandler(spy, 'changeHouseholdMemberRole')({ householdId: HH, userId: U, role: 'admin' }),
    ).rejects.toThrow('403')
  })
})

describe('leaveHousehold', () => {
  const HH = '550e8400-e29b-41d4-a716-446655440000'

  it('POSTs to /leave and confirms', async () => {
    const server = createMcpServer()
    const spy = vi.spyOn(server, 'tool')
    registerIdentityTools(server, mockApi as never)
    mockRequest.mockReset().mockResolvedValueOnce(undefined)

    const result = (await getHandler(spy, 'leaveHousehold')({ householdId: HH })) as {
      content: { text: string }[]
    }
    expect(mockRequest).toHaveBeenCalledWith(`/v1/households/${HH}/leave`, { method: 'POST' })
    expect(result.content[0]!.text).toBe('Left the household.')
  })

  it('surfaces the 409 when the owner tries to leave', async () => {
    const server = createMcpServer()
    const spy = vi.spyOn(server, 'tool')
    registerIdentityTools(server, mockApi as never)
    mockRequest.mockReset().mockRejectedValueOnce(new Error('API 409: The owner cannot leave'))
    await expect(getHandler(spy, 'leaveHousehold')({ householdId: HH })).rejects.toThrow('409')
  })
})

// The schema and description are the agent's whole contract for these tools:
// a dropped field or a vague description makes the agent call them wrong.
describe('household tools: agent-facing contract', () => {
  function registration(name: string) {
    const server = createMcpServer()
    const spy = vi.spyOn(server, 'tool')
    registerIdentityTools(server, mockApi as never)
    const call = spy.mock.calls.find((c: unknown[]) => c[0] === name)!
    return {
      description: call[1] as string,
      shape: call[2] as unknown as Record<
        string,
        { safeParse: (v: unknown) => { success: boolean }; description?: string }
      >,
    }
  }
  const UUID = '550e8400-e29b-41d4-a716-446655440000'

  it('changeHouseholdMemberRole takes uuid householdId + userId and a role', () => {
    const { shape, description } = registration('changeHouseholdMemberRole')
    expect(Object.keys(shape).sort()).toEqual(['householdId', 'role', 'userId'])
    expect(shape['householdId']!.safeParse(UUID).success).toBe(true)
    expect(shape['householdId']!.safeParse('casa').success).toBe(false)
    expect(shape['userId']!.safeParse('ana').success).toBe(false)
    expect(description).toMatch(/owner or an admin/)
    expect(description).toMatch(/owner's own role never changes/)
    expect(description).toMatch(/Viewers are read-only/)
    expect(description).toMatch(/listHouseholdMembers/)
    expect(shape['householdId']!.description).toBe('Household the member belongs to')
    expect(shape['userId']!.description).toBe('Member whose role changes')
    expect(shape['role']!.description).toBe('New role')
  })

  it('leaveHousehold takes a uuid householdId and says when to decline instead', () => {
    const { shape, description } = registration('leaveHousehold')
    expect(Object.keys(shape)).toEqual(['householdId'])
    expect(shape['householdId']!.safeParse(UUID).success).toBe(true)
    expect(shape['householdId']!.safeParse('casa').success).toBe(false)
    expect(description).toMatch(/owner cannot leave/)
    expect(description).toMatch(/respondToHouseholdInvitation with accept=false/)
    expect(description).toMatch(/sharing .* stops/)
    expect(shape['householdId']!.description).toBe('Household to leave')
  })
})
