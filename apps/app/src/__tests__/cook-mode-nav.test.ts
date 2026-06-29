import { describe, it, expect } from 'vitest'

function cookModeNav(total: number, current: number) {
  return {
    isFirst: current === 0,
    isLast: current === total - 1,
    actionLabel: current === total - 1 ? 'Finalizar' : 'Siguiente',
    next: current < total - 1 ? current + 1 : current,
    prev: current > 0 ? current - 1 : current,
  }
}

describe('cook mode step navigation', () => {
  it('first step: prev disabled, action is Siguiente', () => {
    const { isFirst, isLast, actionLabel } = cookModeNav(3, 0)
    expect(isFirst).toBe(true)
    expect(isLast).toBe(false)
    expect(actionLabel).toBe('Siguiente')
  })

  it('middle step: neither first nor last', () => {
    const { isFirst, isLast, actionLabel } = cookModeNav(3, 1)
    expect(isFirst).toBe(false)
    expect(isLast).toBe(false)
    expect(actionLabel).toBe('Siguiente')
  })

  it('last step: action is Finalizar', () => {
    const { isFirst, isLast, actionLabel } = cookModeNav(3, 2)
    expect(isFirst).toBe(false)
    expect(isLast).toBe(true)
    expect(actionLabel).toBe('Finalizar')
  })

  it('single-step recipe: both first and last', () => {
    const { isFirst, isLast, actionLabel } = cookModeNav(1, 0)
    expect(isFirst).toBe(true)
    expect(isLast).toBe(true)
    expect(actionLabel).toBe('Finalizar')
  })

  it('next does not exceed last index', () => {
    expect(cookModeNav(3, 2).next).toBe(2)
  })

  it('prev does not go below 0', () => {
    expect(cookModeNav(3, 0).prev).toBe(0)
  })

  it('advances correctly through all steps', () => {
    let idx = 0
    const total = 5
    while (idx < total - 1) {
      idx = cookModeNav(total, idx).next
    }
    expect(idx).toBe(total - 1)
  })
})
