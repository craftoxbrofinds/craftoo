import 'server-only'
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto'
import { createClient, type User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'

export const FLOWER_QUEST_CAMPAIGN = 'flower-quest'

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

export function getGameSecret(): string {
  const secret = process.env.GAME_SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new ApiError('Game session service is not configured', 503)
  }
  return secret
}

export function getServiceClient() {
  return createAdminClient()
}

export async function getOptionalUser(req: Request): Promise<User | null> {
  const authorization = req.headers.get('authorization')
  if (!authorization) return null

  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization)
  if (!match) throw new ApiError('Unauthorized', 401)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new ApiError('Authentication service is not configured', 503)

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error } = await supabase.auth.getUser(match[1])
  if (error || !user) throw new ApiError('Unauthorized', 401)
  return user
}

function hmac(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

function safeEqualHex(value: string, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(value)) return false
  const actualBytes = Buffer.from(value, 'hex')
  const expectedBytes = Buffer.from(expected, 'hex')
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

export function createRunToken(runId: string, expiresAt: number, secret: string): string {
  return `${expiresAt}.${hmac(`${runId}:${expiresAt}`, secret)}`
}

export function verifyRunToken(
  runId: string,
  token: unknown,
  expiresAt: string,
  secret: string
): boolean {
  if (typeof token !== 'string') return false
  const match = /^(\d{10})\.([a-f0-9]{64})$/i.exec(token)
  if (!match) return false

  const tokenExpiry = Number(match[1])
  const rowExpiry = Math.floor(new Date(expiresAt).getTime() / 1000)
  if (tokenExpiry !== rowExpiry || tokenExpiry <= Math.floor(Date.now() / 1000)) return false
  return safeEqualHex(match[2], hmac(`${runId}:${tokenExpiry}`, secret))
}

export function getGuestId(req: Request, secret: string): string | null {
  const cookie = req.headers.get('cookie')?.split(';')
    .map(part => part.trim())
    .find(part => part.startsWith('flower_quest_guest='))
    ?.slice('flower_quest_guest='.length)
  if (!cookie) return null

  const match = /^([0-9a-f-]{36})\.([a-f0-9]{64})$/i.exec(cookie)
  if (!match || !safeEqualHex(match[2], hmac(`guest:${match[1]}`, secret))) return null
  return match[1]
}

export function createGuestCookie(guestId: string, secret: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `flower_quest_guest=${guestId}.${hmac(`guest:${guestId}`, secret)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secure}`
}

export function createSubjectHash(subject: string): string {
  return createHash('sha256').update(subject).digest('hex')
}

export function createGuestId(): string {
  return randomUUID()
}

/**
 * Turns an error into a JSON response. `label` is only logged on the server; shoppers see
 * `publicMessage`, so payment and coupon routes don't report a game failure.
 */
export function handleApiError(
  error: unknown,
  label: string,
  publicMessage = 'Something went wrong. Please try again in a moment.',
): Response {
  if (error instanceof ApiError) {
    // 5xx ApiErrors mean missing configuration or a dependency being down, which someone should see.
    if (error.status >= 500) logger.warn(label, { status: error.status, reason: error.message })
    else logger.debug(label, { status: error.status, reason: error.message })
    return Response.json({ error: error.message }, { status: error.status })
  }
  logger.error(label, { error })
  return Response.json({ error: publicMessage }, { status: 500 })
}
