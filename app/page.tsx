'use client'

import { useAccount } from 'wagmi'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ConnectWallet } from '@/components/ConnectWallet'
import { SignIn } from '@/components/SignIn'
import { WatchlistForm } from '@/components/WatchlistForm'
import { WatchlistTable } from '@/components/WatchlistTable'
import { Subscribe } from '@/components/Subscribe'
import { TrendingTokens } from '@/components/TrendingTokens'
import { WatchItem } from '@/lib/types'

type Tab = 'trending' | 'watches'

interface BillingStatus {
  active: boolean
  enforced: boolean
  configured: boolean
  plan: { priceUsdc: string; periodInDays: number }
  nextPeriodStart: string | null
}

function Dashboard({ userAddress }: { userAddress: string }) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('trending')

  const { data: items = [], isLoading } = useQuery<WatchItem[]>({
    queryKey: ['watchlist', userAddress],
    queryFn: async () => {
      // Auth is via the session cookie; the address keys the cache only.
      const res = await fetch('/api/watchlist')
      if (!res.ok) throw new Error('Failed to fetch watchlist')
      return res.json() as Promise<WatchItem[]>
    },
  })

  const { data: billing } = useQuery<BillingStatus>({
    queryKey: ['billing', userAddress],
    queryFn: async () => {
      const res = await fetch('/api/billing/status')
      if (!res.ok) throw new Error('Failed to fetch billing status')
      return res.json() as Promise<BillingStatus>
    },
  })

  function refetch() {
    void queryClient.invalidateQueries({ queryKey: ['watchlist', userAddress] })
  }

  function refetchBilling() {
    void queryClient.invalidateQueries({ queryKey: ['billing', userAddress] })
  }

  // Hard gate: billing on + not subscribed → require a subscription first.
  if (billing && billing.enforced && billing.configured && !billing.active) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Subscribe
          priceUsdc={billing.plan.priceUsdc}
          periodInDays={billing.plan.periodInDays}
          onSubscribed={refetchBilling}
        />
      </main>
    )
  }

  // Soft upsell: billing available but not enforced and not yet subscribed.
  const showUpsell = billing && billing.configured && !billing.active && !billing.enforced

  const tabBtn = (id: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
    }`

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <nav className="flex gap-1 bg-gray-900/50 border border-gray-800 rounded-xl p-1 w-fit">
        <button className={tabBtn('trending')} onClick={() => setTab('trending')}>
          Trending
        </button>
        <button className={tabBtn('watches')} onClick={() => setTab('watches')}>
          My Watches
        </button>
      </nav>

      {showUpsell && (
        <Subscribe
          priceUsdc={billing.plan.priceUsdc}
          periodInDays={billing.plan.periodInDays}
          onSubscribed={refetchBilling}
        />
      )}

      {tab === 'trending' ? (
        <section>
          <h3 className="font-semibold text-sm mb-4">Trending on Base</h3>
          <TrendingTokens />
        </section>
      ) : (
        <div className="space-y-8">
          <WatchlistForm onAdded={refetch} />
          <section>
            <h3 className="font-semibold text-sm mb-4">Your Watches</h3>
            {isLoading ? (
              <p className="text-gray-500 text-sm">Loading…</p>
            ) : (
              <WatchlistTable items={items} onRemoved={refetch} />
            )}
          </section>
        </div>
      )}
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
