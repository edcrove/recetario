import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'

// Sign-out, sign-in and a 401 must all drop the shared query cache, otherwise
// the next user on a shared device sees the previous user's cached data.

const { unauthorized, store } = vi.hoisted(() => ({
  unauthorized: { handler: null as (() => void) | null },
  store: new Map<string, string>(),
}))

vi.mock('../api/client', () => ({
  api: { auth: { me: vi.fn().mockResolvedValue({ id: 'user-a' }) } },
  setOnUnauthorized: (h: (() => void) | null) => {
    unauthorized.handler = h
  },
}))

vi.mock('../utils/authStorage', () => ({
  authStorage: {
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string) => void store.set(k, v),
    del: async (k: string) => void store.delete(k),
  },
}))

import { AuthProvider, useAuth } from '../providers/AuthProvider'
import { queryClient } from '../providers/QueryProvider'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

function seedCache() {
  queryClient.setQueryData(['recipes'], [{ id: 'a-recipe', title: 'Receta de A' }])
  queryClient.setQueryData(['profile'], { allergens: ['maní'] })
}

beforeEach(() => {
  store.clear()
  queryClient.clear()
})

async function signedIn() {
  store.set('auth_token', 'token-a')
  const hook = renderHook(() => useAuth(), { wrapper })
  await waitFor(() => expect(hook.result.current.token).toBe('token-a'))
  return hook
}

describe('AuthProvider query cache', () => {
  it('signOut clears every cached query', async () => {
    const { result } = await signedIn()
    seedCache()

    await act(() => result.current.signOut())

    expect(result.current.token).toBeNull()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('signIn starts the new session with an empty cache', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    seedCache()

    await act(() => result.current.signIn('token-b'))

    expect(result.current.token).toBe('token-b')
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('a 401 on an active session clears the cache and the token', async () => {
    const { result } = await signedIn()
    seedCache()

    act(() => unauthorized.handler?.())

    await waitFor(() => expect(result.current.token).toBeNull())
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(store.has('auth_token')).toBe(false)
  })

  it('a 401 with no session (login screen) leaves the cache alone', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    seedCache()

    act(() => unauthorized.handler?.())

    expect(queryClient.getQueryCache().getAll()).toHaveLength(2)
  })
})
