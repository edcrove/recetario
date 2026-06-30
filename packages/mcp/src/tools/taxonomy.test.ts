import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMcpServer } from '../index.js'
import { registerTaxonomyTools } from './taxonomy.js'

const mockRequest = vi.fn()
const mockApi = { request: mockRequest }

beforeEach(() => mockRequest.mockReset())

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHandler(spy: any, name: string) {
  const call = spy.mock.calls.find((c: unknown[]) => c[0] === name)
  return call?.[call.length - 1] as (...args: unknown[]) => Promise<unknown>
}

describe('registerTaxonomyTools', () => {
  it('registers all 6 taxonomy tools', () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerTaxonomyTools(server, mockApi as never)
    const names = spy.mock.calls.map((c: unknown[]) => c[0])
    expect(names).toContain('getFoodTypes')
    expect(names).toContain('createCollection')
    expect(names).toContain('listCollections')
    expect(names).toContain('addToCollection')
    expect(names).toContain('addRecipeRelation')
    expect(names).toContain('getRelatedRecipes')
  })
})

describe('getFoodTypes', () => {
  it('calls GET /v1/food-types', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerTaxonomyTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce([{ id: 'f1', name: 'Guiso', slug: 'guiso' }])
    const result = await getHandler(spy, 'getFoodTypes')()
    expect(JSON.stringify(result)).toContain('Guiso')
    expect(mockRequest).toHaveBeenCalledWith('/v1/food-types')
  })
})

describe('createCollection', () => {
  it('calls POST /v1/collections', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerTaxonomyTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce({ id: 'c1', name: 'Favoritas', emoji: '⭐' })
    await getHandler(spy, 'createCollection')({ name: 'Favoritas', emoji: '⭐' })
    expect(mockRequest).toHaveBeenCalledWith(
      '/v1/collections',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('addRecipeRelation', () => {
  it('calls POST /v1/recipes/:id/relations with createdBy=agent', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerTaxonomyTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce({ fromId: 'r1', toId: 'r2', relationType: 'similar' })
    await getHandler(
      spy,
      'addRecipeRelation',
    )({ fromId: 'r1', toId: 'r2', relationType: 'similar' })
    expect(mockRequest).toHaveBeenCalledWith(
      '/v1/recipes/r1/relations',
      expect.objectContaining({ method: 'POST' }),
    )
    const opts = mockRequest.mock.calls[0]?.[1] as { body: string } | undefined
    const body = JSON.parse(opts?.body ?? '{}') as { createdBy?: string }
    expect(body.createdBy).toBe('agent')
  })
})
