import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from './client'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('api.recipes.list', () => {
  it('calls GET /v1/recipes with Authorization header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    })

    await api.recipes.list()

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/recipes')
    expect((options.headers as Record<string, string>)['Authorization']).toMatch(/^Bearer /)
  })

  it('throws on 401 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    })

    await expect(api.recipes.list()).rejects.toThrow('API 401')
  })
})

describe('api.recipes.get', () => {
  it('calls GET /v1/recipes/:id', async () => {
    const recipe = { id: 'test-uuid', title: 'Pasta' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => recipe,
    })

    const result = await api.recipes.get('test-uuid')

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/recipes/test-uuid')
    expect(result).toEqual(recipe)
  })
})
