import { describe, it, expect } from 'vitest'
import { apiErrorMessage } from '../utils/apiError'

describe('apiErrorMessage', () => {
  it('shows validation details, one per line', () => {
    const msg = `API 400: ${JSON.stringify({
      error: 'Validation error',
      details: [{ message: '"vegano" no se cumple: contiene Chorizo' }, { message: 'otra' }],
    })}`
    expect(apiErrorMessage(msg)).toBe('"vegano" no se cumple: contiene Chorizo\notra')
  })

  it('falls back to the error field', () => {
    expect(apiErrorMessage('API 404: {"error":"Recipe not found"}')).toBe('Recipe not found')
    expect(apiErrorMessage('API 400: {"error":"x","details":[{}]}')).toBe('x')
  })

  it('gives a generic message for bodies without text', () => {
    expect(apiErrorMessage('API 500: {}')).toBe('Error del servidor (500)')
    expect(apiErrorMessage('API 502: <html>')).toBe('Error del servidor (502)')
  })

  it('passes non-API messages through', () => {
    expect(apiErrorMessage('Failed to fetch')).toBe('Failed to fetch')
  })
})
