import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { createApiClient } from '../index.js'

// The unify-vs-differentiate rules from the spec, embedded in the tool
// descriptions so the agent curates well without re-reading the doc.
const RULES = [
  'Rules: (1) interchangeable in a recipe without changing the dish → synonym',
  '(pechuga/suprema → pollo, cebolla morada → cebolla). (2) different cooking/use',
  '→ a SEPARATE canonical in the same family (muslo, pata are not pollo).',
  '(3) only a physical form → a presentation, NOT an ingredient (picado, rallado)',
  '— these need no mapping; the normalizer strips them.',
].join(' ')

export function registerIngredientCurationTools(
  server: McpServer,
  api: ReturnType<typeof createApiClient>,
) {
  server.tool(
    'listUnmatchedIngredients',
    `List the distinct ingredient names in your recipes that do not yet resolve to a canonical ingredient, with how often each appears (most frequent first). Use this to find what to curate, then map each with setIngredientSynonym or createCanonicalIngredient. ${RULES}`,
    async () => {
      const list = await api.request('/v1/ingredients/unmatched')
      return { content: [{ type: 'text' as const, text: JSON.stringify(list, null, 2) }] }
    },
  )

  server.tool(
    'createCanonicalIngredient',
    `Create a new canonical ingredient (the real unit of matching). Optionally place it in a family (created if new) for broad "what can I cook with X" search. ${RULES}`,
    {
      name: z.string().min(1).describe('Canonical display name, e.g. "Muslo de pollo"'),
      family: z
        .string()
        .min(1)
        .optional()
        .describe('Optional family name to group related canonicals, e.g. "pollo"'),
    },
    async ({ name, family }) => {
      const body = family ? { name, familyName: family } : { name }
      const created = await api.request('/v1/ingredients/canonical', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return { content: [{ type: 'text' as const, text: JSON.stringify(created, null, 2) }] }
    },
  )

  server.tool(
    'setIngredientSynonym',
    `Map a surface string to an existing canonical ingredient so they combine everywhere (shopping list, pantry, search). Presentation words are ignored automatically. ${RULES}`,
    {
      synonym: z.string().min(1).describe('The surface string, e.g. "suprema de pollo"'),
      canonicalName: z
        .string()
        .min(1)
        .describe('The canonical it maps to, e.g. "Pollo" (must already exist)'),
    },
    async ({ synonym, canonicalName }) => {
      const result = await api.request('/v1/ingredients/synonym', {
        method: 'POST',
        body: JSON.stringify({ surface: synonym, canonicalName }),
      })
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    },
  )
}
