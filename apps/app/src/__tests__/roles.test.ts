import { describe, it, expect } from 'vitest'
import { isViewerInAnyHousehold, isForeignRecipe } from '../utils/roles'

describe('isViewerInAnyHousehold', () => {
  const uid = 'user-1'

  it('is false without households or user', () => {
    expect(isViewerInAnyHousehold(undefined, uid)).toBe(false)
    expect(isViewerInAnyHousehold([], uid)).toBe(false)
    expect(isViewerInAnyHousehold([{ members: [{ userId: uid, role: 'viewer' }] }], null)).toBe(
      false,
    )
  })

  it('is true when the user is a viewer in any household', () => {
    const households = [
      { members: [{ userId: 'other', role: 'owner' }] },
      { members: [{ userId: uid, role: 'viewer' }] },
    ]
    expect(isViewerInAnyHousehold(households, uid)).toBe(true)
  })

  it('is false when the user is owner/admin/member everywhere', () => {
    const households = [
      { members: [{ userId: uid, role: 'member' }] },
      { members: [{ userId: uid, role: 'owner' }] },
      { members: undefined },
    ]
    expect(isViewerInAnyHousehold(households, uid)).toBe(false)
  })

  it("ignores other users' viewer roles", () => {
    expect(isViewerInAnyHousehold([{ members: [{ userId: 'other', role: 'viewer' }] }], uid)).toBe(
      false,
    )
  })
})

describe('isForeignRecipe', () => {
  it('is true only when both ids exist and differ', () => {
    expect(isForeignRecipe('a', 'b')).toBe(true)
    expect(isForeignRecipe('a', 'a')).toBe(false)
    expect(isForeignRecipe(undefined, 'a')).toBe(false)
    expect(isForeignRecipe('a', null)).toBe(false)
  })
})
