'use client'

import { useState } from 'react'
import { subscribe } from '@base-org/account/payment/browser'

interface PlanResponse {
  owner: string
  priceUsdc: string
  periodInDays: number
  testnet: boolean
}

interface SubscribeProps {
  priceUsdc: string
  periodInDays: number
  onSubscribed: () => void
}

export function Subscribe({ priceUsdc, periodInDays, onSubscribed }: SubscribeProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe() {
    setLoading(true)
    setError(null)
    try {
      const planRes = await fetch('/api/billing/plan')
      if (!planRes.ok) throw new Error('Billing is unavailable right now')
      const plan = (await planRes.json()) as PlanResponse

      // subscribe()'s options are a discriminated union on `testnet`; branch so
      // the literal type matches.
      const result = plan.testnet
        ? await subscribe({
            recurringCharge: plan.priceUsdc,
            subscriptionOwner: plan.owner,
            periodInDays: plan.periodInDays,
            testnet: true,
          })
        : await subscribe({
            recurringCharge: plan.priceUsdc,
            subscriptionOwner: plan.owner,
            periodInDays: plan.periodInDays,
            testnet: false,
          })

      const saveRes = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: result.id }),
      })
      if (!saveRes.ok) {
        const data = (await saveRes.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || 'Could not save subscription')
      }

      onSubscribed()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
      <h3 className="font-semibold text-sm">Subscribe to Base Watch</h3>
      <p className="text-gray-400 text-sm">
        {priceUsdc} USDC every {periodInDays} days. Paid with Base Pay — cancel anytime from your
        wallet.
      </p>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-2 px-5 text-sm font-medium transition-colors"
      >
        {loading ? 'Confirm in your wallet…' : `Subscribe · ${priceUsdc} USDC`}
      </button>
    </div>
  )
}
