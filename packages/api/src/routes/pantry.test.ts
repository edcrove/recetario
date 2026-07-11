import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'

vi.mock('../db/pantry-repository.js', () => {
  const mockRepo = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  }
  return { pantryRepository: mockRepo, PantryRepository: vi.fn(() => mockRepo) }
})

vi.mock('../db/index.js', () => ({
  getDb: vi.fn(() => {
    throw new Error('DB not available in tests')
  }),
  schema: {},
}))

import { app } from '../index.js'
import { pantryRepository } from '../db/pantry-repository.js'

const mockRepo = pantryRepository as unknown as {
  list: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

const DEV_KEY = 'pantry-test-key'
const AUTH = { Authorization: `Bearer ${DEV_KEY}` }
const JSON_AUTH = { ...AUTH, 'Content-Type': 'application/json' }
const ID = '550e8400-e29b-41d4-a716-446655440000'
const item = {
  id: ID,
  ownerId: 'o',
  name: 'Harina',
  quantity: '1',
  unit: 'kg',
  expiryDate: null,
  inStock: true,
}

beforeAll(() => {
  process.env['DEV_API_KEY'] = DEV_KEY
})
afterAll(() => {
  delete process.env['DEV_API_KEY']
})
beforeEach(() => vi.clearAllMocks())

describe('GET /v1/pantry', () => {
  it('lists the pantry', async () => {
    mockRepo.list.mockResolvedValue([item])
    const res = await app.request('/v1/pantry', { headers: AUTH })
    expect(res.status).toBe(200)
    expect((await res.json())[0].name).toBe('Harina')
  })
  it('requires auth', async () => {
    expect((await app.request('/v1/pantry')).status).toBe(401)
  })
})

describe('POST /v1/pantry', () => {
  it('creates an item (201)', async () => {
    mockRepo.create.mockResolvedValue(item)
    const res = await app.request('/v1/pantry', {
      method: 'POST',
      headers: JSON_AUTH,
      body: JSON.stringify({ name: 'Harina', quantity: '1', unit: 'kg' }),
    })
    expect(res.status).toBe(201)
    expect(mockRepo.create).toHaveBeenCalledWith(expect.any(String), {
      name: 'Harina',
      quantity: '1',
      unit: 'kg',
    })
  })
  it('rejects an empty name (400)', async () => {
    const res = await app.request('/v1/pantry', {
      method: 'POST',
      headers: JSON_AUTH,
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(400)
  })
  it('rejects a malformed expiryDate (400)', async () => {
    const res = await app.request('/v1/pantry', {
      method: 'POST',
      headers: JSON_AUTH,
      body: JSON.stringify({ name: 'x', expiryDate: 'nope' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /v1/pantry/{id}', () => {
  it('updates an item (200)', async () => {
    mockRepo.update.mockResolvedValue({ ...item, inStock: false })
    const res = await app.request(`/v1/pantry/${ID}`, {
      method: 'PATCH',
      headers: JSON_AUTH,
      body: JSON.stringify({ inStock: false }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).inStock).toBe(false)
  })
  it('404s when not found/visible', async () => {
    mockRepo.update.mockResolvedValue(null)
    const res = await app.request(`/v1/pantry/${ID}`, {
      method: 'PATCH',
      headers: JSON_AUTH,
      body: JSON.stringify({ inStock: false }),
    })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /v1/pantry/{id}', () => {
  it('deletes (204)', async () => {
    mockRepo.remove.mockResolvedValue(true)
    const res = await app.request(`/v1/pantry/${ID}`, { method: 'DELETE', headers: AUTH })
    expect(res.status).toBe(204)
  })
  it('404s when not found/visible', async () => {
    mockRepo.remove.mockResolvedValue(false)
    const res = await app.request(`/v1/pantry/${ID}`, { method: 'DELETE', headers: AUTH })
    expect(res.status).toBe(404)
  })
})
