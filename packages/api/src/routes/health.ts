import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

export const healthRoute = new OpenAPIHono()

const route = createRoute({
  method: 'get',
  path: '/health',
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ status: z.literal('ok') }) } },
      description: 'API is healthy',
    },
  },
})

healthRoute.openapi(route, (c) => c.json({ status: 'ok' as const }))
