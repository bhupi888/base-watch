import { NextResponse } from 'next/server'
import { generateSiweNonce } from 'viem/siwe'
import { NONCE_COOKIE, NONCE_TTL_SECONDS } from '@/lib/session'

// Issues a one-time SIWE nonce and stashes it in an HttpOnly cookie. /verify
// compares the signed message's nonce against this cookie to prevent replay.
export async function GET() {
  const nonce = generateSiweNonce()
  const res = NextResponse.json({ nonce })
  res.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: NONCE_TTL_SECONDS,
  })
  return res
}
