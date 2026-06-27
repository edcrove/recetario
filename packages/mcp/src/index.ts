// TODO: Implement MCP server for Recetario
// The MCP package provides the agent write path: MCP → API → DB
// No LLM inference happens in the app; all AI interactions go through this server.
//
// Phase 1 will implement:
// - McpServer from @modelcontextprotocol/sdk
// - Tools: create_recipe, update_recipe, search_recipes, etc.

import { VERSION } from '@recetario/shared'

console.log(`@recetario/mcp starting (shared version: ${VERSION})`)
