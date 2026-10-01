import { OpenAPIHono } from '@hono/zod-openapi'

/**
 * Every route module uses this instead of `new OpenAPIHono()` so request
 * validation failures share one JSON shape: `{ error, details }` (400).
 */
export function createRouter() {
  return new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: 'Validation error',
            details: result.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
          400,
        )
      }
    },
  })
}
