import { describe, it, expect } from 'vitest'
import { jwtSubject } from '../utils/jwtSubject'

const b64url = (o: object) =>
  btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwt = (payload: object) => `${b64url({ alg: 'HS256' })}.${b64url(payload)}.sig`

describe('jwtSubject', () => {
  it("reads the token's user id", () => {
    expect(jwtSubject(jwt({ sub: 'u-1', email: 'a@b.c' }))).toBe('u-1')
  })

  it('handles base64url characters in the payload', () => {
    // '{"sub":"~~~"}' has a '+' in base64 ('-' in base64url); '???' has a '/' ('_')
    expect(b64url({ sub: '~~~' })).toContain('-')
    expect(jwtSubject(jwt({ sub: '~~~' }))).toBe('~~~')
    expect(b64url({ sub: '???' })).toContain('_')
    expect(jwtSubject(jwt({ sub: '???' }))).toBe('???')
  })

  it('is null for anything that is not a JWT with a string subject', () => {
    for (const token of ['', 'abc', 'a.!!!.c', jwt({}), jwt({ sub: 42 }), jwt({ sub: '' })])
      expect(jwtSubject(token)).toBeNull()
  })
})
