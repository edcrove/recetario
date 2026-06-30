import { hash, compare } from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const RAW_JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-secret-change-in-production'
const JWT_SECRET = new TextEncoder().encode(RAW_JWT_SECRET)

/** Call at app startup to ensure JWT_SECRET is properly set in production. */
export function assertJwtSecretConfigured(): void {
  if (
    process.env['NODE_ENV'] === 'production' &&
    RAW_JWT_SECRET === 'dev-secret-change-in-production'
  ) {
    throw new Error(
      'JWT_SECRET env var is not set. This is required in production. ' +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
    )
  }
}
const JWT_ALGORITHM = 'HS256'
const JWT_EXPIRY = '7d'

export interface JwtPayload {
  sub: string // user UUID
  email: string
  householdId?: string
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, 12)
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return compare(plain, hashed)
}

export async function signJwt(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET)
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] })
    return {
      sub: payload.sub as string,
      email: payload['email'] as string,
      householdId: payload['householdId'] as string | undefined,
    }
  } catch {
    return null
  }
}
