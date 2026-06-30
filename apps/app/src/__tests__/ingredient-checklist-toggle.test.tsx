// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'

function useChecklistState(count: number) {
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  return { checked, toggle }
}

describe('IngredientChecklist toggle state', () => {
  it('starts with no items checked', () => {
    const { result } = renderHook(() => useChecklistState(3))
    expect(result.current.checked.size).toBe(0)
  })

  it('checking an item adds it to the set', () => {
    const { result } = renderHook(() => useChecklistState(3))
    act(() => result.current.toggle(1))
    expect(result.current.checked.has(1)).toBe(true)
  })

  it('unchecking a checked item removes it', () => {
    const { result } = renderHook(() => useChecklistState(3))
    act(() => result.current.toggle(0))
    expect(result.current.checked.has(0)).toBe(true)
    act(() => result.current.toggle(0))
    expect(result.current.checked.has(0)).toBe(false)
  })

  it('multiple items can be checked independently', () => {
    const { result } = renderHook(() => useChecklistState(5))
    act(() => result.current.toggle(0))
    act(() => result.current.toggle(2))
    act(() => result.current.toggle(4))
    expect(result.current.checked.size).toBe(3)
    expect(result.current.checked.has(1)).toBe(false)
    expect(result.current.checked.has(3)).toBe(false)
  })

  it('toggling one item does not affect others', () => {
    const { result } = renderHook(() => useChecklistState(3))
    act(() => result.current.toggle(0))
    act(() => result.current.toggle(1))
    act(() => result.current.toggle(0))
    expect(result.current.checked.has(0)).toBe(false)
    expect(result.current.checked.has(1)).toBe(true)
  })
})
