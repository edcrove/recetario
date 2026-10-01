import { describe, expect, it } from 'vitest'
import { app } from './index.js'

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'ok' })
  })
})

describe('body size limit', () => {
  it('refuses bodies over 1 MB with a JSON 413 before parsing', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.c', password: 'x'.repeat(1024 * 1024 + 10) }),
    })
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: 'Payload too large' })
  })
})
