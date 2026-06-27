import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { createApiClient } from '../index.js'

// Simplified input schema for the MCP tool (agent-friendly)
// The server does full validation; we give rich descriptions here
const CreateRecipeInput = z.object({
  title: z.string().describe('Recipe title'),
  servings: z.number().int().positive().describe('Number of servings this recipe makes'),
  category: z
    .enum(['Desayuno', 'Almuerzo', 'Cena', 'Postre', 'Snack', 'Bebida', 'Otro'])
    .describe('Meal category'),
  tags: z.array(z.string()).optional().default([]).describe('Free-form tags'),
  prepTimeMin: z.number().int().positive().optional().describe('Prep time in minutes'),
  cookTimeMin: z.number().int().positive().optional().describe('Cook time in minutes'),
  totalTimeMin: z.number().int().positive().optional().describe('Total time in minutes'),
  notes: z.string().optional().describe('Recipe notes or description'),
  ingredients: z
    .array(
      z.object({
        name: z.string().describe('Ingredient name'),
        quantity: z.number().nullable().describe('Amount (null for "to taste")'),
        unit: z
          .enum(['tsp', 'tbsp', 'cup', 'ml', 'l', 'g', 'kg', 'unit', 'pinch', 'slice', 'clove'])
          .nullable()
          .describe('Unit of measurement (null for countable items or "to taste")'),
        presentation: z.string().optional().describe('How prepared: "diced", "melted", etc.'),
        group: z.string().optional().describe('Ingredient group: "For the sauce"'),
        note: z.string().optional(),
      }),
    )
    .min(1)
    .describe('List of ingredients (minimum 1)'),
  steps: z
    .array(
      z.object({
        text: z.string().describe('Step instructions'),
        durationMin: z.number().int().positive().optional(),
        ovenTempC: z.number().optional(),
      }),
    )
    .optional()
    .default([])
    .describe('Cooking steps in order'),
  sourceUrl: z.string().url().optional().describe('Original URL if scraped from web'),
  sourceType: z.enum(['url', 'photo', 'manual', 'mcp']).optional().default('mcp'),
  externalId: z.string().optional().describe('External ID for deduplication'),
  originalLanguage: z.string().optional().default('es'),
})

export function registerCreateRecipe(server: McpServer, api: ReturnType<typeof createApiClient>) {
  server.tool(
    'createRecipe',
    'Create or update a recipe. If the same sourceUrl or externalId already exists for this user, it performs an upsert (update). Returns the recipe and whether it was newly created.',
    CreateRecipeInput.shape,
    async (input) => {
      // Build the payload
      const payload = {
        ...input,
        source:
          (input.sourceUrl ?? input.sourceType)
            ? {
                type: input.sourceType ?? 'mcp',
                url: input.sourceUrl,
                externalId: input.externalId,
              }
            : { type: 'mcp' as const },
      }

      try {
        const result = await api.request('/v1/recipes', {
          method: 'POST',
          body: JSON.stringify(payload),
        })

        const warnings: string[] = []
        if (!input.steps || input.steps.length === 0) {
          warnings.push('No steps provided. Consider adding cooking steps.')
        }
        if (!input.totalTimeMin && !input.cookTimeMin) {
          warnings.push('No cooking time provided.')
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  recipe: result,
                  warnings: warnings.length > 0 ? warnings : undefined,
                },
                null,
                2,
              ),
            },
          ],
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        // Return structured feedback instead of throwing
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  error: 'Failed to create recipe',
                  detail: message,
                  suggestions: [
                    'Ensure title is provided',
                    'Ensure at least one ingredient is included',
                    'Check that category is one of: Desayuno, Almuerzo, Cena, Postre, Snack, Bebida, Otro',
                    'Check that units are valid: tsp, tbsp, cup, ml, l, g, kg, unit, pinch, slice, clove',
                  ],
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        }
      }
    },
  )
}
