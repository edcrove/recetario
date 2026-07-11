import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMcpServer } from '../index.js'
import { registerIngredientCurationTools } from './ingredientCuration.js'

const mockRequest = vi.fn()
const mockApi = { request: mockRequest }

beforeEach(() => mockRequest.mockReset())

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHandler(spy: any, name: string) {
  const call = spy.mock.calls.find((c: unknown[]) => c[0] === name)
  return call?.[call.length - 1] as (...args: unknown[]) => Promise<unknown>
}

describe('registerIngredientCurationTools', () => {
  it('registers the three curation tools', () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerIngredientCurationTools(server, mockApi as never)
    const names = spy.mock.calls.map((c: unknown[]) => c[0])
    expect(names).toEqual([
      'listUnmatchedIngredients',
      'createCanonicalIngredient',
      'setIngredientSynonym',
    ])
  })

  it('listUnmatchedIngredients GETs the unmatched endpoint', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerIngredientCurationTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce([
      { name: 'suprema de pollo', normalized: 'suprema de pollo', count: 3 },
    ])
    const result = await getHandler(spy, 'listUnmatchedIngredients')()
    expect(mockRequest).toHaveBeenCalledWith('/v1/ingredients/unmatched')
    expect(JSON.stringify(result)).toContain('suprema de pollo')
  })

  it('createCanonicalIngredient posts name only', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerIngredientCurationTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce({ id: 'c1', name: 'Kale', normalizedName: 'kale' })
    await getHandler(spy, 'createCanonicalIngredient')({ name: 'Kale' })
    expect(mockRequest).toHaveBeenCalledWith('/v1/ingredients/canonical', {
      method: 'POST',
      body: JSON.stringify({ name: 'Kale' }),
    })
  })

  it('createCanonicalIngredient posts name + family when given', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerIngredientCurationTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce({
      id: 'c2',
      name: 'Muslo de pollo',
      normalizedName: 'muslo de pollo',
    })
    const result = await getHandler(
      spy,
      'createCanonicalIngredient',
    )({
      name: 'Muslo de pollo',
      family: 'pollo',
    })
    expect(mockRequest).toHaveBeenCalledWith('/v1/ingredients/canonical', {
      method: 'POST',
      body: JSON.stringify({ name: 'Muslo de pollo', familyName: 'pollo' }),
    })
    expect(JSON.stringify(result)).toContain('Muslo de pollo')
  })

  it('setIngredientSynonym posts surface + canonicalName', async () => {
    const server = createMcpServer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = vi.spyOn(server as any, 'tool')
    registerIngredientCurationTools(server, mockApi as never)
    mockRequest.mockResolvedValueOnce({ id: 's1', synonym: 'suprema de pollo' })
    const result = await getHandler(
      spy,
      'setIngredientSynonym',
    )({
      synonym: 'Suprema de pollo',
      canonicalName: 'Pollo',
    })
    expect(mockRequest).toHaveBeenCalledWith('/v1/ingredients/synonym', {
      method: 'POST',
      body: JSON.stringify({ surface: 'Suprema de pollo', canonicalName: 'Pollo' }),
    })
    expect(JSON.stringify(result)).toContain('suprema de pollo')
  })
})
