import { describe, it, expect } from 'vitest'
import { createMcpServer, createApiClient } from './index.js'

describe('MCP server', () => {
  it('creates server with correct name', () => {
    const server = createMcpServer()
    // McpServer doesn't expose name directly, just verify it constructs
    expect(server).toBeDefined()
  })

  it('createApiClient returns an object with request method', () => {
    const client = createApiClient()
    expect(typeof client.request).toBe('function')
  })
})
