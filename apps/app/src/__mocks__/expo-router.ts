import { vi } from 'vitest'

export const useRouter = vi.fn(() => ({
  push: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
  canGoBack: vi.fn(() => true),
}))

export const useLocalSearchParams = vi.fn(() => ({ id: 'test-recipe-id' }))
