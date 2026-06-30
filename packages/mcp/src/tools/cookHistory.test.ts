import { describe, it, expect, vi } from 'vitest'
import { createMcpServer } from '../index.js'
import { registerCookHistoryTools } from './cookHistory.js'

const mockRequest = vi.fn()
const mockApi = { request: mockRequest }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHandler(spy: any, name: string) {
  const call = spy.mock.calls.find((c: unknown[]) => c[0] === name)
  return call?.[call.length - 1] as (...args: unknown[]) => Promise<unknown>
}

describe('registerCookHistoryTools', () => {
  it('registers logCookSession, getCookHistory, getMostCooked', () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerCookHistoryTools(server, mockApi as never)
    const names = spy.mock.calls.map((c: unknown[]) => c[0])
    expect(names).toContain('logCookSession')
    expect(names).toContain('getCookHistory')
    expect(names).toContain('getMostCooked')
  })
})

describe('logCookSession', () => {
  it('calls POST /v1/cook-sessions with args', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerCookHistoryTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce({ id: 's1', recipeId: 'r1', rating: 4 })
    await getHandler(spy, 'logCookSession')({ recipeId: 'r1', rating: 4, notes: 'Good' })
    expect(mockRequest).toHaveBeenCalledWith(
      '/v1/cook-sessions',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('getCookHistory', () => {
  it('calls GET /v1/cook-sessions with recipeId', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerCookHistoryTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce([])
    await getHandler(spy, 'getCookHistory')({ recipeId: 'r1', limit: 5 })
    expect(mockRequest).toHaveBeenCalledWith(expect.stringContaining('cook-sessions'))
  })
})

describe('getMostCooked', () => {
  it('calls GET /v1/cook-sessions/stats', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerCookHistoryTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce({ totalSessions: 5, topRecipes: [], frequencyByWeek: [] })
    const result = await getHandler(spy, 'getMostCooked')({})
    expect(JSON.stringify(result)).toContain('totalSessions')
    expect(mockRequest).toHaveBeenCalledWith('/v1/cook-sessions/stats')
  })

  it('passes since param when provided', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerCookHistoryTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce({ totalSessions: 0, topRecipes: [], frequencyByWeek: [] })
    await getHandler(spy, 'getMostCooked')({ since: '2026-01-01' })
    expect(mockRequest).toHaveBeenCalledWith('/v1/cook-sessions/stats?since=2026-01-01')
  })
})
