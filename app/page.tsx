'use client'

import { useAccount } from 'wagmi'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ConnectWallet } from '@/components/ConnectWallet'
import { SignIn } from '@/components/SignIn'
import { WatchlistForm } from '@/components/WatchlistForm'
import { WatchlistTable } from '@/components/WatchlistTable'
import { WatchItem } from '@/lib/types'

function Dashboard({ userAddress }: { userAddress: string }) {
  const queryClient = useQueryClient()

  const { data: items = [], isLoading } = useQuery<WatchItem[]>({
    queryKey: ['watchlist', userAddress],
    queryFn: async () => {
      // Auth is via the session cookie; the address keys the cache only.
      const res = await fetch('/api/watchlist')
      if (!res.ok) throw new Error('Failed to fetch watchlist')
      return res.json() as Promise<WatchItem[]>
    },
  })

  function refetch() {
    void queryClient.invalidateQueries({ queryKey: ['watchlist', userAddress] })
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <WatchlistForm onAdded={refetch} />
      <section>
        <h3 className="font-semibold text-sm mb-4">Your Watches</h3>
        {isLoading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : (
          <WatchlistTable items={items} onRemoved={refetch} />
        )}
      </section>
    </main>
  )
}

export default function Home() {
  const { address, status } = useAccount()
  const [signedInAddress, setSignedInAddress] = useState<string | null>(null)

  // Restore an existing session cookie on load so a refresh doesn't re-prompt.
  useEffect(() => {
    let active = true
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { address: string } | null) => {
        if (active && data?.address) setSignedInAddress(data.address)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // A session tied to a different wallet than the one now connected is stale —
  // drop it so the user re-verifies the active wallet.
  const sessionMatchesWallet =
    signedInAddress && address && signedInAddress.toLowerCase() === address.toLowerCase()

  return (
    <ConnectWallet>
      {status === 'connected' && address ? (
        sessionMatchesWallet ? (
          <Dashboard userAddress={signedInAddress!} />
        ) : (
          <SignIn onSignedIn={setSignedInAddress} />
        )
      ) : null}
    </ConnectWallet>
  )
}
