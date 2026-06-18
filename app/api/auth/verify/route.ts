import { NextRequest, NextResponse } from 'next/server'
import { parseSiweMessage, verifySiweMessage } from 'viem/siwe'
import { publicClient } from '@/lib/chain'
import {
  NONCE_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
} from '@/lib/session'

interface VerifyBody {
  message?: string
  signature?: `0x${string}`
}

// Verifies a SIWE signature server-side and issues an HttpOnly session cookie.
// Uses viem's verifySiweMessage with a public client so smart-contract wallets
// (Base App / Coinbase Smart Wallet) verify via EIP-1271/6492, not just EOAs.
export async function POST(req: NextRequest) {
  const { message, signature } = (await req.json()) as VerifyBody
  if (!message || !signature) {
    return NextResponse.json({ error: 'message and signature required' }, { status: 400 })
  }

  const nonce = req.cookies.get(NONCE_COOKIE)?.value
  if (!nonce) {
    return NextResponse.json({ error: 'Missing or expired nonce' }, { status: 401 })
  }

  const parsed = parseSiweMessage(message)
  if (!parsed.address) {
    return NextResponse.json({ error: 'Malformed SIWE message' }, { status: 400 })
  }

  // verifySiweMessage validates message fields (nonce, domain, expiry/notBefore)
  // and verifies the signature on-chain when needed. Binding nonce + domain here
  // closes replay and cross-site reuse.
  const valid = await verifySiweMessage(publicClient, {
    message,
    signature,
    nonce,
    domain: req.headers.get('host') ?? undefined,
  })

  if (!valid) {
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 })
  }

  const token = createSessionToken(parsed.address)
  const res = NextResponse.json({ address: parsed.address.toLowerCase() })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
  // Burn the one-time nonce.
  res.cookies.set(NONCE_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
