import { NextResponse } from 'next/server'
import { TrendingToken } from '@/lib/types'

// Trending tokens on Base, sourced from GeckoTerminal's trending pools (free, no
// key). We map each pool to its base token and surface 5 stats. Cached for 2 min
// to stay well under GeckoTerminal's free rate limit.
const GECKO_API =
  'https://api.geckoterminal.com/api/v2/networks/base/trending_pools?include=base_token&page=1'

interface PoolAttributes {
  base_token_price_usd: string | null
  fdv_usd: string | null
  reserve_in_usd: string | null
  price_change_percentage?: { h24?: string | null }
  volume_usd?: { h24?: string | null }
}

interface Pool {
  attributes: PoolAttributes
  relationships?: { base_token?: { data?: { id?: string } } }
}

interface IncludedToken {
  id: string
  attributes: { address: string; name: string; symbol: string; image_url: string | null }
}

const num = (v: string | null | undefined): number | null => {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function GET() {
  let res: Response
  try {
    res = await fetch(GECKO_API, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 120 },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to reach token data provider' }, { status: 502 })
  }

  if (!res.ok) {
    return NextResponse.json({ error: `Provider error ${res.status}` }, { status: 502 })
  }

  const json = (await res.json()) as { data?: Pool[]; included?: IncludedToken[] }
  const tokensById = new Map((json.included ?? []).map((t) => [t.id, t]))

  const seen = new Set<string>()
  const tokens: TrendingToken[] = []

  for (const pool of json.data ?? []) {
    const id = pool.relationships?.base_token?.data?.id
    const tok = id ? tokensById.get(id) : undefined
    if (!tok) continue

    const address = tok.attributes.address.toLowerCase()
    if (seen.has(address)) continue // a token can trend in several pools; keep the top one
    seen.add(address)

    const a = pool.attributes
    tokens.push({
      address,
      symbol: tok.attributes.symbol,
      name: tok.attributes.name,
      imageUrl: tok.attributes.image_url,
      priceUsd: num(a.base_token_price_usd),
      change24h: num(a.price_change_percentage?.h24),
      volume24h: num(a.volume_usd?.h24),
      liquidityUsd: num(a.reserve_in_usd),
      fdvUsd: num(a.fdv_usd),
    })
  }

  return NextResponse.json(tokens)
}
