import { describe, it, expect } from 'vitest'
import { parseStepDurationSeconds } from './stepDuration.js'

describe('parseStepDurationSeconds', () => {
  // DoD fixtures.
  it('parses "40 min" to 2400 seconds', () => {
    expect(parseStepDurationSeconds('Cocinar 40 min a fuego medio')).toBe(2400)
  })
  it('parses "1 hora y media" to 5400 seconds', () => {
    expect(parseStepDurationSeconds('Dejar reposar 1 hora y media')).toBe(5400)
  })
  it('returns null for "hasta dorar"', () => {
    expect(parseStepDurationSeconds('Freír hasta dorar')).toBeNull()
  })

  it('parses Spanish minute variants', () => {
    expect(parseStepDurationSeconds('30 minutos')).toBe(1800)
    expect(parseStepDurationSeconds('5 minuto')).toBe(300)
  })
  it('parses English units', () => {
    expect(parseStepDurationSeconds('bake for 20 minutes')).toBe(1200)
    expect(parseStepDurationSeconds('rest 2 hours')).toBe(7200)
    expect(parseStepDurationSeconds('wait 90 seconds')).toBe(90)
  })
  it('parses Spanish seconds', () => {
    expect(parseStepDurationSeconds('batir 90 segundos')).toBe(90)
    expect(parseStepDurationSeconds('esperar 30 seg')).toBe(30)
  })
  it('sums multiple unit tokens', () => {
    expect(parseStepDurationSeconds('cocinar 1 h 30 min')).toBe(5400)
    expect(parseStepDurationSeconds('1 hora 15 minutos')).toBe(4500)
  })
  it('uses the upper bound of a range', () => {
    expect(parseStepDurationSeconds('freír 3-4 minutos por lado')).toBe(240)
    expect(parseStepDurationSeconds('hornear 20 a 25 minutos')).toBe(1500)
  })
  it('handles "media hora" (standalone half)', () => {
    expect(parseStepDurationSeconds('reposar media hora')).toBe(1800)
  })
  it('handles decimals with comma or dot', () => {
    expect(parseStepDurationSeconds('1.5 min')).toBe(90)
    expect(parseStepDurationSeconds('1,5 min')).toBe(90)
  })
  it('ignores temperatures and non-time numbers', () => {
    expect(parseStepDurationSeconds('Hornear a 200°C hasta dorar')).toBeNull()
    expect(parseStepDurationSeconds('Repetir 3 veces')).toBeNull()
    expect(parseStepDurationSeconds('Cortar en 4 partes')).toBeNull()
  })
  it('combines a temperature and a real duration correctly', () => {
    expect(parseStepDurationSeconds('Hornear a 200°C por 20 minutos')).toBe(1200)
  })
  it('returns null for text with no numbers or units', () => {
    expect(parseStepDurationSeconds('Salpimentar al gusto')).toBeNull()
  })
})
