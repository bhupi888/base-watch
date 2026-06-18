'use client'

import { useQuery } from '@tanstack/react-query'

interface OhlcvResponse {
  points: number[]
  change: number
}

// Renders a token's 24h price line as a faint full-bleed background. Meant to sit
// behind content (absolute inset-0); the parent should be `relative`.
export function TokenChartBackground({ pool }: { pool: string }) {
  const { data } = useQuery<OhlcvResponse>({
    queryKey: ['ohlcv', pool],
    queryFn: async () => {
      const res = await fetch(`/api/tokens/ohlcv?pool=${pool}`)
      if (!res.ok) throw new Error('Failed to load chart')
      return res.json() as Promise<OhlcvResponse>
    },
    staleTime: 300_000,
  })

  const points = data?.points ?? []
  if (points.length < 2) return null

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const W = 100
  const H = 100
  // y inverted (SVG 0 = top); leave a little headroom top/bottom.
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W
    const y = H - 6 - ((p - min) / range) * (H - 12)
    return [x, y] as const
  })

  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`

  const up = data!.change >= 0
  const stroke = up ? '#22c55e' : '#ef4444'
  const gradId = `chartfill-${up ? 'up' : 'down'}`

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full opacity-[0.18]"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.8" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke={stroke} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
