import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
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
    expect(names).toContain('createTaxonomyItem')
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

describe('createTaxonomyItem', () => {
  it.each(['categories', 'food-types', 'tags'] as const)(
    'POSTs the name to /v1/config/%s and returns the created item',
    async (type) => {
      const server = createMcpServer()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const spy = vi.spyOn(server as any, 'tool')
      registerConfiguratorTools(server, mockApi as never)
      mockRequest.mockResolvedValueOnce({ id: 'n1', name: 'Merienda', slug: 'merienda' })
      const result = await getHandler(spy, 'createTaxonomyItem')({ type, name: 'Merienda' })
      expect(mockRequest).toHaveBeenCalledWith(`/v1/config/${type}`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Merienda' }),
      })
      expect(JSON.stringify(result)).toContain('merienda')
    },
  )

  it('validates type and name (1-100 chars)', () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerConfiguratorTools(server, mockApi as never)
    const call = spy.mock.calls.find((c: unknown[]) => c[0] === 'createTaxonomyItem')!
    expect(call[1]).toMatch(/Create a category, food type or tag/)
    const schema = z.object(call[2] as z.ZodRawShape)
    for (const type of ['categories', 'food-types', 'tags']) {
      expect(schema.safeParse({ type, name: 'x' }).success).toBe(true)
    }
    expect(schema.safeParse({ type: 'tags', name: 'x'.repeat(100) }).success).toBe(true)
    expect(schema.safeParse({ type: 'tags', name: '' }).success).toBe(false)
    expect(schema.safeParse({ type: 'tags', name: 'x'.repeat(101) }).success).toBe(false)
    expect(schema.safeParse({ type: 'collections', name: 'x' }).success).toBe(false)
  })

  it('propagates a 409 duplicate so the agent sees it', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerConfiguratorTools(server, mockApi as never)
    mockRequest.mockRejectedValueOnce(new Error('API error 409: {"error":"Already exists"}'))
    await expect(
      getHandler(spy, 'createTaxonomyItem')({ type: 'tags', name: 'rápida' }),
    ).rejects.toThrow('409')
  })
})

describe('getTaxonomyUsage', () => {
  const id = '00000000-0000-0000-0000-000000000001'

  it.each(['categories', 'food-types', 'tags'] as const)(
    'lists the recipes that use a %s item',
    async (type) => {
      const server = createMcpServer()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const spy = vi.spyOn(server as any, 'tool')
      registerConfiguratorTools(server, mockApi as never)
      mockRequest.mockResolvedValueOnce([
        { id: 'r1', title: 'Guiso' },
        { id: 'r2', title: 'Tarta' },
      ])
      const result = (await getHandler(spy, 'getTaxonomyUsage')({ type, id })) as {
        content: Array<{ text: string }>
      }
      expect(mockRequest).toHaveBeenCalledWith(`/v1/config/${type}/${id}/recipes`)
      expect(result.content[0]!.text).toBe('Used by 2 recipe(s).\n- Guiso (r1)\n- Tarta (r2)')
    },
  )

  it('describes itself and validates type and uuid', () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerConfiguratorTools(server, mockApi as never)
    const call = spy.mock.calls.find((c: unknown[]) => c[0] === 'getTaxonomyUsage')!
    expect(call[1]).toBe('Get which recipes use a specific taxonomy item')
    const schema = z.object(call[2] as z.ZodRawShape)
    for (const type of ['categories', 'food-types', 'tags']) {
      expect(schema.safeParse({ type, id: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b' }).success).toBe(
        true,
      )
    }
    expect(schema.safeParse({ type: 'collections', id }).success).toBe(false)
    expect(schema.safeParse({ type: 'tags', id: 'nope' }).success).toBe(false)
    expect(schema.safeParse({ type: 'tags' }).success).toBe(false)
  })

  it('says 0 recipes when nothing uses it', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerConfiguratorTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce([])
    const result = (await getHandler(spy, 'getTaxonomyUsage')({ type: 'tags', id })) as {
      content: Array<{ text: string }>
    }
    expect(result.content[0]!.text).toBe('Used by 0 recipe(s).')
  })

  it('returns not found on a 404', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerConfiguratorTools(server, mockApi as never)
    mockRequest.mockRejectedValueOnce(new Error('API error 404: {"error":"Not found"}'))
    const result = (await getHandler(spy, 'getTaxonomyUsage')({ type: 'tags', id })) as {
      content: Array<{ type: string; text: string }>
    }
    expect(result.content).toEqual([{ type: 'text', text: 'Item not found.' }])
  })

  it('rethrows any other API error', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerConfiguratorTools(server, mockApi as never)
    mockRequest.mockRejectedValueOnce(new Error('API error 500: {}'))
    await expect(getHandler(spy, 'getTaxonomyUsage')({ type: 'tags', id })).rejects.toThrow(
      'API error 500',
    )
  })
})
