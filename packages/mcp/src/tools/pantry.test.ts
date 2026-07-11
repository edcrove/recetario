import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMcpServer } from '../index.js'
import { registerPantryTools } from './pantry.js'

const mockRequest = vi.fn()
const mockApi = { request: mockRequest }

beforeEach(() => mockRequest.mockReset())

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHandler(spy: any, name: string) {
  const call = spy.mock.calls.find((c: unknown[]) => c[0] === name)
  return call?.[call.length - 1] as (...args: unknown[]) => Promise<unknown>
}

describe('registerPantryTools', () => {
  it('registers update_pantry and what_can_i_cook', () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerPantryTools(server, mockApi as never)
    const names = spy.mock.calls.map((c: unknown[]) => c[0])
    expect(names).toEqual(['update_pantry', 'what_can_i_cook'])
  })

  it('update_pantry POSTs the items to the bulk endpoint', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerPantryTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce([{ id: 'p1', name: 'Harina' }])
    const result = await getHandler(
      spy,
      'update_pantry',
    )({
      items: [{ name: 'Harina', quantity: '2', unit: 'kg' }],
    })
    expect(mockRequest).toHaveBeenCalledWith('/v1/pantry/bulk', {
      method: 'POST',
      body: JSON.stringify({ items: [{ name: 'Harina', quantity: '2', unit: 'kg' }] }),
    })
    expect(JSON.stringify(result)).toContain('Harina')
  })

  it('what_can_i_cook GETs the cookable ranking', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerPantryTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce([{ title: 'Guiso', matchedCount: 2, totalCount: 3 }])
    const result = await getHandler(spy, 'what_can_i_cook')()
    expect(mockRequest).toHaveBeenCalledWith('/v1/pantry/cookable')
    expect(JSON.stringify(result)).toContain('Guiso')
  })
})
