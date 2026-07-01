import { describe, it, expect, vi } from 'vitest'

vi.mock('../db/index.js', () => ({ getDb: vi.fn() }))

import { app } from '../index.js'

describe('CORS middleware', () => {
  it('allows requests from localhost:8081 (Expo web)', async () => {
    const req = new Request('http://localhost:3000/health', {
      headers: { Origin: 'http://localhost:8081' },
    })
    const res = await app.fetch(req)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8081')
  })

  it('allows requests from localhost:19006 (Expo Go)', async () => {
    const req = new Request('http://localhost:3000/health', {
      headers: { Origin: 'http://localhost:19006' },
    })
    const res = await app.fetch(req)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:19006')
  })

  it('handles preflight OPTIONS request', async () => {
    const req = new Request('http://localhost:3000/auth/login', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:8081',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
    expect(res.headers.get('access-control-allow-headers')).toContain('Authorization')
  })
})
