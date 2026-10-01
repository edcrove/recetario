import { describe, it, expect } from 'vitest'
import { addFinishedStep, cookModeNav, dismissFinishedStep } from '../utils/cookModeNav'

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

describe('finished-step banners', () => {
  it('adds a finished step once, keeping the oldest first', () => {
    expect(addFinishedStep([], 2)).toEqual([2])
    expect(addFinishedStep([2], 0)).toEqual([2, 0])
    expect(addFinishedStep([2, 0], 2)).toEqual([2, 0])
  })

  it('dismisses only the given step', () => {
    expect(dismissFinishedStep([2, 0, 1], 0)).toEqual([2, 1])
    expect(dismissFinishedStep([2], 5)).toEqual([2])
  })
})
