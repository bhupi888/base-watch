// Stateless, HMAC-signed session tokens + the cookies that carry SIWE auth.
// No DB round-trip: the token is `base64url(payload).base64url(hmac)` and is
// validated by recomputing the HMAC, so any tampering invalidates it.
import { createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

const SECRET = process.env.SESSION_SECRET || process.env.CRON_SECRET

export const SESSION_COOKIE = 'bw_session'
export const NONCE_COOKIE = 'bw_siwe_nonce'

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days
export const NONCE_TTL_SECONDS = 60 * 10 // 10 minutes

export interface SessionPayload {
  address: string // lowercased wallet address
  exp: number // unix seconds
}

function sign(body: string): string {
  if (!SECRET) throw new Error('SESSION_SECRET (or CRON_SECRET) must be set')
  return createHmac('sha256', SECRET).update(body).digest('base64url')
}

export function createSessionToken(address: string): string {
  const payload: SessionPayload = {
    address: address.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null

  const expected = sign(body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload
    if (typeof payload.address !== 'string' || typeof payload.exp !== 'number') return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// Returns the authenticated, lowercased address for a request, or null if the
// session cookie is missing/invalid/expired.
export function getSessionAddress(req: NextRequest): string | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  return verifySessionToken(token)?.address ?? null
}
