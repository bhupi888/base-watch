'use client'

import { useAccount, useSignMessage } from 'wagmi'
import { createSiweMessage } from 'viem/siwe'
import { useState } from 'react'

interface SignInProps {
  onSignedIn: (address: string) => void
}

export function SignIn({ onSignedIn }: SignInProps) {
  const { address, chainId } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn() {
    if (!address || !chainId) return
    setSigning(true)
    setError(null)

    try {
      // 1. Get a server-issued nonce (stored in an HttpOnly cookie server-side).
      const nonceRes = await fetch('/api/auth/nonce')
      if (!nonceRes.ok) throw new Error('Could not start sign-in')
      const { nonce } = (await nonceRes.json()) as { nonce: string }

      // 2. Build + sign the SIWE message with that nonce.
      const message = createSiweMessage({
        address,
        chainId,
        domain: window.location.host,
        nonce,
        uri: window.location.origin,
        version: '1',
        statement: 'Sign in to Base Watch',
      })

      const signature = await signMessageAsync({ message })

      // 3. Verify server-side; the server sets a signed session cookie on success.
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      })
      if (!verifyRes.ok) {
        const data = (await verifyRes.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || 'Verification failed')
      }

      const { address: verified } = (await verifyRes.json()) as { address: string }
      onSignedIn(verified)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setSigning(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-57px)] gap-4">
      <h2 className="text-xl font-semibold">Verify your wallet</h2>
      <p className="text-gray-400 text-sm text-center max-w-xs">
        Sign a message to prove ownership of your wallet. No gas required.
      </p>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={handleSignIn}
        disabled={signing}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-3 px-8 text-sm font-medium transition-colors"
      >
        {signing ? 'Waiting for signature…' : 'Sign In with Ethereum'}
      </button>
    </div>
  )
}
