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

describe('api.recipes.create', () => {
  it('calls POST /v1/recipes with body', async () => {
    const data = {
      title: 'Pasta',
      servings: 2,
      category: 'Main',
      ingredients: [{ name: 'Pasta', quantity: 200, unit: 'g' }],
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 'new-id', ...data }),
    })

    const result = await api.recipes.create(data as never)
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/recipes')
    expect(options.method).toBe('POST')
    expect(result.id).toBe('new-id')
  })
})

describe('api.recipes.update', () => {
  it('calls PUT /v1/recipes/:id with body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'abc', title: 'Updated' }),
    })

    await api.recipes.update('abc', { title: 'Updated' })
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/recipes/abc')
    expect(options.method).toBe('PUT')
  })
})

describe('api.recipes.delete', () => {
  it('calls DELETE /v1/recipes/:id and returns undefined on 204', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 })

    const result = await api.recipes.delete('abc')
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/recipes/abc')
    expect(options.method).toBe('DELETE')
    expect(result).toBeUndefined()
  })
})

describe('api.menu.getWeek', () => {
  it('calls GET /v1/menu?weekStart=...', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })

    const result = await api.menu.getWeek('2026-06-29')
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/menu?weekStart=2026-06-29')
    expect(result).toEqual([])
  })
})

describe('api.menu.add', () => {
  it('calls POST /v1/menu with entry data', async () => {
    const entry = { date: '2026-06-29', slot: 'Almuerzo', recipeId: 'r1', servings: 2 }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 'e1', ...entry }),
    })

    await api.menu.add(entry)
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/menu')
    expect(options.method).toBe('POST')
  })
})

describe('api.menu.remove', () => {
  it('calls DELETE /v1/menu/:date/:slot with encoded slot', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 })

    await api.menu.remove('2026-06-29', 'Snacks/Otros')
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/menu/2026-06-29/Snacks%2FOtros')
    expect(options.method).toBe('DELETE')
  })
})

describe('api.menu.shoppingList', () => {
  it('calls GET /v1/menu/shopping-list?weekStart=...', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })

    const result = await api.menu.shoppingList('2026-06-29')
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/menu/shopping-list?weekStart=2026-06-29')
    expect(result).toEqual([])
  })
})

describe('api.households.invite', () => {
  // Regression test for the 2026-07-03 audit finding: inviting used to send a
  // raw userId (which required knowing someone's UUID). Now it sends email.
  it('calls POST /v1/households/:id/invite with email in the body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ userId: 'u1', role: 'member' }),
    })

    await api.households.invite('hh1', 'amigo@example.com', 'member')
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/households/hh1/invite')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body as string)
    expect(body).toEqual({ email: 'amigo@example.com', role: 'member' })
  })
})
