'use client'

import { useState } from 'react'
import { WatchType, WatchDirection } from '@/lib/types'

export interface WatchPrefill {
  tokenAddress: string
  label: string
  poolAddress?: string // for the 24h chart background; form ignores it
}

interface WatchlistFormProps {
  onAdded: () => void
  // When set (e.g. from the Trending tab), start as an ERC-20 watch for this token.
  // The form remounts on tab switch, so reading it in useState initializers is enough.
  prefill?: WatchPrefill | null
}

export function WatchlistForm({ onAdded, prefill }: WatchlistFormProps) {
  const [label, setLabel] = useState(prefill?.label ?? '')
  const [watchedAddress, setWatchedAddress] = useState('')
  const [type, setType] = useState<WatchType>(prefill ? 'erc20' : 'native')
  const [tokenAddress, setTokenAddress] = useState(prefill?.tokenAddress ?? '')
  const [direction, setDirection] = useState<WatchDirection>('any')
  const [thresholdEth, setThresholdEth] = useState('0.1')
  const [autoPost, setAutoPost] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchedAddress,
          label,
          type,
          tokenAddress: type === 'erc20' ? tokenAddress : undefined,
          direction,
          thresholdEth: parseFloat(thresholdEth),
          autoPost,
        }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error: string }
        throw new Error(data.error)
      }

      setLabel('')
      setWatchedAddress('')
      setTokenAddress('')
      setThresholdEth('0.1')
      setAutoPost(false)
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add watch')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-gray-900 rounded-xl p-5 border border-gray-800">
      <h3 className="font-semibold text-sm">Add Watch</h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="My whale"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Address to watch *</label>
          <input
            value={watchedAddress}
            onChange={(e) => setWatchedAddress(e.target.value)}
            placeholder="0x…"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as WatchType)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="native">Native ETH</option>
            <option value="erc20">ERC-20 Token</option>
          </select>
        </div>

        {type === 'erc20' && (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Token contract *</label>
            <input
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              placeholder="0x…"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Direction</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as WatchDirection)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="any">Any movement</option>
            <option value="in">Incoming only</option>
            <option value="out">Outgoing only</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">
            Threshold ({type === 'native' ? 'ETH' : 'tokens'}) *
          </label>
          <input
            type="number"
            value={thresholdEth}
            onChange={(e) => setThresholdEth(e.target.value)}
            step="any"
            min="0"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="autoPost"
          checked={autoPost}
          onChange={(e) => setAutoPost(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="autoPost" className="text-xs text-gray-400">
          Auto-post alert to Base App feed when triggered
        </label>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-2 px-5 text-sm font-medium transition-colors"
      >
        {loading ? 'Adding…' : 'Add Watch'}
      </button>
    </form>
  )
}
