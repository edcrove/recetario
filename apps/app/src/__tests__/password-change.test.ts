import { describe, it, expect } from 'vitest'
import { canChangePassword, passwordChangeError } from '../utils/passwordChange'

describe('canChangePassword', () => {
  it('needs the current password and a different new one of 8+ characters', () => {
    expect(canChangePassword('temporal123', 'mi-clave-nueva')).toBe(true)
    expect(canChangePassword('', 'mi-clave-nueva')).toBe(false)
    expect(canChangePassword('temporal123', 'corta')).toBe(false)
    expect(canChangePassword('temporal123', 'temporal123')).toBe(false)
  })
})

describe('passwordChangeError', () => {
  const err = (m: string) => new Error(m)
  it('explains the API answers in Spanish', () => {
    expect(passwordChangeError(err('API 401: {"error":"Current password is incorrect"}'), '')).toBe(
      'La contraseña actual no es correcta.',
    )
    expect(passwordChangeError(err('API 400: {}'), '')).toMatch(/distinta y de 8 caracteres/)
    expect(passwordChangeError(err('API 429: {}'), '')).toMatch(/Demasiados intentos/)
    expect(passwordChangeError(err('API 500: {}'), '')).toMatch(/No se pudo cambiar/)
    expect(passwordChangeError(err('Network down'), '')).toMatch(/No se pudo cambiar/)
  })

  it('hints while the new password is too short, and stays quiet otherwise', () => {
    expect(passwordChangeError(null, 'abc')).toBe(
      'La nueva contraseña necesita al menos 8 caracteres.',
    )
    expect(passwordChangeError(null, '')).toBeUndefined()
    expect(passwordChangeError(null, 'suficiente')).toBeUndefined()
  })
})
