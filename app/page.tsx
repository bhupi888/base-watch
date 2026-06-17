'use client'

import { useAccount } from 'wagmi'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
      const res = await fetch(`/api/watchlist?userAddress=${userAddress}`)
      if (!res.ok) throw new Error('Failed to fetch watchlist')
      return res.json() as Promise<WatchItem[]>
    },
  })

  function refetch() {
    void queryClient.invalidateQueries({ queryKey: ['watchlist', userAddress] })
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <WatchlistForm userAddress={userAddress} onAdded={refetch} />
      <section>
        <h3 className="font-semibold text-sm mb-4">Your Watches</h3>
        {isLoading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : (
          <WatchlistTable items={items} userAddress={userAddress} onRemoved={refetch} />
        )}
      </section>
    </main>
  )
}

export default function Home() {
  const { address, status } = useAccount()
  const [signedInAddress, setSignedInAddress] = useState<string | null>(null)

  return (
    <ConnectWallet>
      {status === 'connected' && address ? (
        signedInAddress ? (
          <Dashboard userAddress={signedInAddress} />
        ) : (
          <SignIn onSignedIn={setSignedInAddress} />
        )
      ) : null}
    </ConnectWallet>
  )
}
