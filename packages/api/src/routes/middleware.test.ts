import { describe, it, expect, vi } from 'vitest'

vi.mock('../db/index.js', () => ({ getDb: vi.fn() }))

import { app } from '../index.js'

describe('CORS middleware', () => {
  it('allows requests from localhost:8081 (Expo web dev)', async () => {
    const req = new Request('http://localhost:3000/health', {
      headers: { Origin: 'http://localhost:8081' },
    })
    const res = await app.fetch(req)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8081')
  })

  it('allows requests from localhost:8080 (Docker app)', async () => {
    const req = new Request('http://localhost:3000/health', {
      headers: { Origin: 'http://localhost:8080' },
    })
    const res = await app.fetch(req)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8080')
  })

  it('allows requests from localhost:19006 (Expo Go)', async () => {
    const req = new Request('http://localhost:3000/health', {
      headers: { Origin: 'http://localhost:19006' },
    })
    const res = await app.fetch(req)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:19006')
  })

  it('blocks requests from non-localhost origins', async () => {
    const req = new Request('http://localhost:3000/health', {
      headers: { Origin: 'https://evil.com' },
    })
    const res = await app.fetch(req)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('allows private-LAN origins so other devices on the router can connect', async () => {
    for (const origin of [
      'http://192.168.0.37:8080',
      'http://10.0.0.5:8080',
      'http://172.16.4.2:3000',
    ]) {
      const res = await app.fetch(
        new Request('http://localhost:3000/health', { headers: { Origin: origin } }),
      )
      expect(res.headers.get('access-control-allow-origin')).toBe(origin)
    }
  })

  it('blocks public IPs that merely look private-adjacent', async () => {
    // 172.15.x and 192.169.x are OUTSIDE the RFC 1918 ranges
    for (const origin of ['http://172.15.0.1:8080', 'http://192.169.0.1:8080']) {
      const res = await app.fetch(
        new Request('http://localhost:3000/health', { headers: { Origin: origin } }),
      )
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
    }
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
