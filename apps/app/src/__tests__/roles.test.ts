import { describe, it, expect } from 'vitest'
import {
  isViewerInAnyHousehold,
  isForeignRecipe,
  memberLabel,
  pendingInvitations,
  inviteErrorMessage,
} from '../utils/roles'

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
      { members: [{ userId: uid, role: 'viewer', acceptedAt: '2026-10-01' }] },
    ]
    expect(isViewerInAnyHousehold(households, uid)).toBe(true)
  })

  it('a pending viewer invite does not restrict the user (matches the API)', () => {
    expect(
      isViewerInAnyHousehold(
        [{ members: [{ userId: uid, role: 'viewer', acceptedAt: null }] }],
        uid,
      ),
    ).toBe(false)
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

describe('memberLabel', () => {
  it('prefers display name, then email, then a short id', () => {
    expect(
      memberLabel({ userId: 'abcdef123456', role: 'member', displayName: 'Ana', email: 'a@x' }),
    ).toBe('Ana')
    expect(
      memberLabel({ userId: 'abcdef123456', role: 'member', displayName: '  ', email: 'a@x' }),
    ).toBe('a@x')
    expect(memberLabel({ userId: 'abcdef123456', role: 'member' })).toBe('abcdef12…')
  })
})

describe('pendingInvitations', () => {
  const uid = 'me'
  it('returns households where my membership is not accepted yet', () => {
    const hh = [
      { id: 'a', members: [{ userId: uid, role: 'member', acceptedAt: null }] },
      { id: 'b', members: [{ userId: uid, role: 'owner', acceptedAt: '2026-10-01' }] },
      { id: 'c', members: [{ userId: 'other', role: 'owner', acceptedAt: null }] },
      { id: 'd' },
    ]
    expect(pendingInvitations(hh, uid).map((h) => h.id)).toEqual(['a'])
  })
  it('is empty without data or user', () => {
    expect(pendingInvitations(undefined, uid)).toEqual([])
    expect(pendingInvitations([{ id: 'a', members: [] }], null)).toEqual([])
  })
})

describe('inviteErrorMessage', () => {
  it('maps API status codes to Spanish messages', () => {
    expect(inviteErrorMessage(new Error('API 404: {}'))).toMatch(/registre/)
    expect(inviteErrorMessage(new Error('API 409: {}'))).toMatch(/ya está/)
    expect(inviteErrorMessage(new Error('API 403: {}'))).toMatch(/dueño/)
    expect(inviteErrorMessage(new Error('Network'))).toMatch(/Probá de nuevo/)
    expect(inviteErrorMessage('x')).toMatch(/Probá de nuevo/)
  })
})
