import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const API_BASE_URL = process.env['API_BASE_URL'] ?? 'http://localhost:3000'
const API_KEY = process.env['MCP_API_KEY'] ?? ''

export function createApiClient() {
  return {
    async request(path: string, options: RequestInit = {}) {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
          ...options.headers,
        },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(`API error ${res.status}: ${JSON.stringify(body)}`)
      }
      return res.json()
    },
  }
}

export function createMcpServer() {
  const server = new McpServer({
    name: 'recetario',
    version: '1.0.0',
  })
  return server
}

export async function registerAllTools(
  server: ReturnType<typeof createMcpServer>,
  apiClient: ReturnType<typeof createApiClient>,
): Promise<void> {
  const { registerCreateRecipe } = await import('./tools/createRecipe.js')
  const { registerReadTools } = await import('./tools/readRecipes.js')
  const { registerMutationTools } = await import('./tools/mutateRecipes.js')
  const { registerMenuTools } = await import('./tools/menu.js')
  const { registerIdentityTools } = await import('./tools/identity.js')

  registerCreateRecipe(server, apiClient)
  registerReadTools(server, apiClient)
  registerMutationTools(server, apiClient)
  registerMenuTools(server, apiClient)
  registerIdentityTools(server, apiClient)
}

async function main() {
  const server = createMcpServer()
  const apiClient = createApiClient()
  await registerAllTools(server, apiClient)
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Recetario MCP server running on stdio')
}

if (process.env['NODE_ENV'] !== 'test') {
  main().catch(console.error)
}
