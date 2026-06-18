'use client'

import { useQuery } from '@tanstack/react-query'
import { TrendingToken } from '@/lib/types'

function compactUsd(n: number | null): string {
  if (n === null) return '—'
  if (n === 0) return '$0'
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function priceUsd(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  // small prices: show enough significant digits
  return `$${n.toPrecision(3)}`
}

function pct(n: number | null): { text: string; cls: string } {
  if (n === null) return { text: '—', cls: 'text-gray-500' }
  const cls = n > 0 ? 'text-green-400' : n < 0 ? 'text-red-400' : 'text-gray-400'
  const sign = n > 0 ? '+' : ''
  return { text: `${sign}${n.toFixed(2)}%`, cls }
}

function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-sm font-medium ${cls ?? ''}`}>{value}</div>
    </div>
  )
}

export function TrendingTokens() {
  const { data: tokens = [], isLoading, isError } = useQuery<TrendingToken[]>({
    queryKey: ['trending-tokens'],
    queryFn: async () => {
      const res = await fetch('/api/tokens/trending')
      if (!res.ok) throw new Error('Failed to load trending tokens')
      return res.json() as Promise<TrendingToken[]>
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  if (isLoading) return <p className="text-gray-500 text-sm">Loading trending tokens…</p>
  if (isError) return <p className="text-red-400 text-sm">Couldn’t load trending tokens. Try again shortly.</p>
  if (tokens.length === 0) return <p className="text-gray-500 text-sm">No trending tokens right now.</p>

  return (
    <div className="space-y-3">
      {tokens.map((t, i) => {
        const change = pct(t.change24h)
        return (
          <div
            key={t.address}
            className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-gray-600 w-4 shrink-0">{i + 1}</span>
              {t.imageUrl ? (
                // Token logos come from many remote hosts; <img> avoids next/image remote config.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.imageUrl} alt="" className="w-7 h-7 rounded-full bg-gray-800" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-[10px] text-gray-400">
                  {t.symbol.slice(0, 3)}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{t.symbol}</div>
                <div className="text-xs text-gray-500 truncate">{t.name}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-sm font-semibold">{priceUsd(t.priceUsd)}</div>
                <div className={`text-xs ${change.cls}`}>{change.text}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 pl-7">
              <Stat label="TVL" value={compactUsd(t.liquidityUsd)} />
              <Stat label="FDV" value={compactUsd(t.fdvUsd)} />
              <Stat label="Vol 24h" value={compactUsd(t.volume24h)} />
            </div>
          </div>
        )
      })}
      <p className="text-[10px] text-gray-600 text-center pt-1">Data from GeckoTerminal · refreshes every 2 min</p>
    </div>
  )
}
