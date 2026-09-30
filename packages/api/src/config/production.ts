type Env = Record<string, string | undefined>

// Secrets that have shipped in this repo (defaults, .env.example, docker-compose)
const KNOWN_PLACEHOLDERS = new Set([
  'dev-secret-change-in-production',
  'change-me-in-production-use-64-random-hex-chars',
])
const GENERATE_HINT =
  "generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""

/**
 * Startup checks for NODE_ENV=production. The deployed API (Railway) must have a
 * real JWT secret (≥64 hex chars, not a repo placeholder) and no DEV_API_KEY
 * fallback. docker-compose and CI also run with NODE_ENV=production to mimic the
 * deploy; they set ALLOW_DEV_SECRETS=true, which only keeps the "secret is set"
 * check. Never set ALLOW_DEV_SECRETS on a real deploy.
 */
export function productionConfigErrors(env: Env = process.env): string[] {
  if (env['NODE_ENV'] !== 'production') return []
  const secret = env['JWT_SECRET']
  if (!secret) return [`JWT_SECRET is not set; ${GENERATE_HINT}`]
  if (env['ALLOW_DEV_SECRETS'] === 'true') return []

  const errors: string[] = []
  if (KNOWN_PLACEHOLDERS.has(secret)) {
    errors.push(`JWT_SECRET is a placeholder from the repo; ${GENERATE_HINT}`)
  } else if (!/^[0-9a-f]{64,}$/i.test(secret)) {
    errors.push(`JWT_SECRET must be at least 64 hex characters; ${GENERATE_HINT}`)
  }
  if (env['DEV_API_KEY']) {
    errors.push('DEV_API_KEY must not be set in production (it bypasses API-key auth)')
  }
  return errors
}

export function assertProductionConfig(env: Env = process.env): void {
  const errors = productionConfigErrors(env)
  if (errors.length > 0) {
    throw new Error(`Refusing to start:\n- ${errors.join('\n- ')}`)
  }
}

/**
 * Self-service sign-up. Closed by default in production (a family app: accounts
 * are opened on purpose), open elsewhere. REGISTRATION_OPEN=true|false overrides.
 */
export function registrationOpen(env: Env = process.env): boolean {
  const flag = env['REGISTRATION_OPEN']
  if (flag === 'true') return true
  if (flag === 'false') return false
  return env['NODE_ENV'] !== 'production'
}
