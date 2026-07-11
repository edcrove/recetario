import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMcpServer } from '../index.js'
import { registerSuggestionTools } from './suggestions.js'

const mockRequest = vi.fn()
const mockApi = { request: mockRequest }

beforeEach(() => mockRequest.mockReset())

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHandler(spy: any, name: string) {
  const call = spy.mock.calls.find((c: unknown[]) => c[0] === name)
  return call?.[call.length - 1] as (...args: unknown[]) => Promise<unknown>
}

describe('registerSuggestionTools', () => {
  it('registers both tools', () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerSuggestionTools(server, mockApi as never)
    expect(spy.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      'suggest_from_ingredients',
      'get_menu_missing_ingredients',
    ])
  })

  it('suggest_from_ingredients posts only the provided fields', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerSuggestionTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce([{ id: 'r', title: 'Guiso' }])
    const result = await getHandler(
      spy,
      'suggest_from_ingredients',
    )({ ingredients: ['pollo'], usePantry: true, date: '2026-07-13' })
    expect(mockRequest).toHaveBeenCalledWith('/v1/suggestions/from-ingredients', {
      method: 'POST',
      body: JSON.stringify({ ingredients: ['pollo'], usePantry: true, date: '2026-07-13' }),
    })
    expect(JSON.stringify(result)).toContain('Guiso')
  })

  it('suggest_from_ingredients omits absent optional fields', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerSuggestionTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce([])
    await getHandler(spy, 'suggest_from_ingredients')({ usePantry: true })
    expect(mockRequest).toHaveBeenCalledWith('/v1/suggestions/from-ingredients', {
      method: 'POST',
      body: JSON.stringify({ usePantry: true }),
    })
  })

  it('get_menu_missing_ingredients GETs the week gap', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerSuggestionTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce({ missing: [], meals: [] })
    await getHandler(spy, 'get_menu_missing_ingredients')({ weekStart: '2026-07-06' })
    expect(mockRequest).toHaveBeenCalledWith('/v1/menu/missing-ingredients?weekStart=2026-07-06')
  })
})
