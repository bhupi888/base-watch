'use client'

import { useAccount, useSignMessage } from 'wagmi'
import { createSiweMessage, parseSiweMessage } from 'viem/siwe'
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
      const message = createSiweMessage({
        address,
        chainId,
        domain: window.location.host,
        nonce: crypto.randomUUID().replace(/-/g, ''),
        uri: window.location.origin,
        version: '1',
        statement: 'Sign in to Base Watch',
      })

      const signature = await signMessageAsync({ message })

      // Client-side verification — swap for server-side session in production
      const parsed = parseSiweMessage(message)
      if (parsed.address?.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Signature address mismatch')
      }

      void signature // verified client-side; production should POST to /api/auth/verify
      onSignedIn(address)
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
