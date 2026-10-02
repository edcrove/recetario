/**
 * The user id (`sub`) inside a JWT, read without verifying it — the API
 * verifies on every request. Lets the app know who is signed in as soon as the
 * token is loaded, instead of waiting for GET /auth/me: until then every
 * "is this mine?" check (planner dishes, Editar on a recipe) read as "no".
 */
export function jwtSubject(token: string): string | null {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const sub = (JSON.parse(json) as { sub?: unknown }).sub
    return typeof sub === 'string' && sub ? sub : null
  } catch {
    return null
  }
}
