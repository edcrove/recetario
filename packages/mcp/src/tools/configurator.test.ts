import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMcpServer } from '../index.js'
import { registerConfiguratorTools } from './configurator.js'

const mockRequest = vi.fn()
const mockApi = { request: mockRequest }

beforeEach(() => mockRequest.mockReset())

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHandler(spy: any, name: string) {
  const call = spy.mock.calls.find((c: unknown[]) => c[0] === name)
  return call?.[call.length - 1] as (...args: unknown[]) => Promise<unknown>
}

describe('registerConfiguratorTools', () => {
  it('registers listTaxonomy, renameTaxonomyItem, mergeTags, getTaxonomyUsage', () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerConfiguratorTools(server, mockApi as never)
    const names = spy.mock.calls.map((c: unknown[]) => c[0])
    expect(names).toContain('listTaxonomy')
    expect(names).toContain('renameTaxonomyItem')
    expect(names).toContain('mergeTags')
    expect(names).toContain('getTaxonomyUsage')
  })
})

describe('listTaxonomy', () => {
  it('calls GET /v1/config/taxonomy', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerConfiguratorTools(server, mockApi as never)
    const taxonomy = { mealCategories: [], foodTypes: [], tags: [] }
    mockRequest.mockResolvedValueOnce(taxonomy)
    const result = await getHandler(spy, 'listTaxonomy')({})
    expect(JSON.stringify(result)).toContain('mealCategories')
    expect(mockRequest).toHaveBeenCalledWith('/v1/config/taxonomy')
  })
})

describe('renameTaxonomyItem', () => {
  it('calls PATCH /v1/config/:type/:id with new name', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerConfiguratorTools(server, mockApi as never)
    const id = '00000000-0000-0000-0000-000000000001'
    mockRequest.mockResolvedValueOnce({ id, name: 'Nuevo' })
    const result = await getHandler(
      spy,
      'renameTaxonomyItem',
    )({ type: 'tags', id, newName: 'Nuevo' })
    expect(JSON.stringify(result)).toContain('Nuevo')
    expect(mockRequest).toHaveBeenCalledWith(
      `/v1/config/tags/${id}`,
      expect.objectContaining({ method: 'PATCH' }),
    )
  })
})

describe('mergeTags', () => {
  it('calls POST /v1/config/tags/merge', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerConfiguratorTools(server, mockApi as never)
    const sourceId = '00000000-0000-0000-0000-000000000001'
    const targetId = '00000000-0000-0000-0000-000000000002'
    mockRequest.mockResolvedValueOnce({ merged: 3 })
    const result = await getHandler(spy, 'mergeTags')({ sourceId, targetId })
    expect(JSON.stringify(result)).toContain('merged')
    expect(mockRequest).toHaveBeenCalledWith(
      '/v1/config/tags/merge',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('getTaxonomyUsage', () => {
  const id = '00000000-0000-0000-0000-000000000001'
  const taxonomy = {
    mealCategories: [{ id, name: 'Desayuno', usageCount: 5 }],
    foodTypes: [{ id: 'f1', name: 'Guiso', usageCount: 2 }],
    tags: [{ id: 't1', name: 'rápida', usageCount: 8 }],
  }

  it('returns usage count for a category', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerConfiguratorTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce(taxonomy)
    const result = await getHandler(spy, 'getTaxonomyUsage')({ type: 'categories', id })
    expect(JSON.stringify(result)).toContain('5 recipe')
  })

  it('returns usage for food-types', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerConfiguratorTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce(taxonomy)
    const result = await getHandler(spy, 'getTaxonomyUsage')({ type: 'food-types', id: 'f1' })
    expect(JSON.stringify(result)).toContain('2 recipe')
  })

  it('returns usage for tags', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerConfiguratorTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce(taxonomy)
    const result = await getHandler(spy, 'getTaxonomyUsage')({ type: 'tags', id: 't1' })
    expect(JSON.stringify(result)).toContain('8 recipe')
  })

  it('returns not found when id does not exist', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerConfiguratorTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce(taxonomy)
    const result = await getHandler(spy, 'getTaxonomyUsage')({ type: 'tags', id: 'nonexistent' })
    expect(JSON.stringify(result)).toContain('not found')
  })
})
