import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

export const QUERY_DEFAULT_OPTIONS = {
  staleTime: 30_000,
  retry: 1,
} as const

const queryClient = new QueryClient({
  defaultOptions: { queries: QUERY_DEFAULT_OPTIONS },
})

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
