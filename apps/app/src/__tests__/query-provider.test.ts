import { describe, it, expect } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { QUERY_DEFAULT_OPTIONS } from '../providers/QueryProvider'

describe('QueryProvider config', () => {
  it('staleTime is 30 seconds', () => {
    expect(QUERY_DEFAULT_OPTIONS.staleTime).toBe(30_000)
  })

  it('retry is 1', () => {
    expect(QUERY_DEFAULT_OPTIONS.retry).toBe(1)
  })

  it('QueryClient picks up the default options', () => {
    const client = new QueryClient({ defaultOptions: { queries: QUERY_DEFAULT_OPTIONS } })
    const defaults = client.getDefaultOptions().queries
    expect(defaults?.staleTime).toBe(30_000)
    expect(defaults?.retry).toBe(1)
  })
})
