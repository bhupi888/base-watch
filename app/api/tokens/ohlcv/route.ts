import { NextRequest, NextResponse } from 'next/server'

// 24h hourly close prices for a Base pool, from GeckoTerminal OHLCV.
// Returns chronological closes + the period change %. Cached 5 min.
export async function GET(req: NextRequest) {
  const pool = req.nextUrl.searchParams.get('pool')
  if (!pool || !/^0x[a-fA-F0-9]{40}$/.test(pool)) {
    return NextResponse.json({ error: 'valid pool address required' }, { status: 400 })
  }

  const url = `https://api.geckoterminal.com/api/v2/networks/base/pools/${pool}/ohlcv/hour?aggregate=1&limit=24`

  let res: Response
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 300 } })
  } catch {
    return NextResponse.json({ error: 'Failed to reach data provider' }, { status: 502 })
  }
  if (!res.ok) {
    return NextResponse.json({ error: `Provider error ${res.status}` }, { status: 502 })
  }

  const json = (await res.json()) as {
    data?: { attributes?: { ohlcv_list?: number[][] } }
  }

  // ohlcv_list rows are [ts, open, high, low, close, volume], newest-first.
  const rows = json.data?.attributes?.ohlcv_list ?? []
  const points = rows
    .map((r) => r[4])
    .filter((c): c is number => typeof c === 'number' && Number.isFinite(c))
    .reverse() // → chronological

  const change =
    points.length >= 2 && points[0] !== 0
      ? ((points[points.length - 1] - points[0]) / points[0]) * 100
      : 0

  return NextResponse.json({ points, change })
}
