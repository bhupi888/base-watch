import { NextResponse } from 'next/server'
import { billingConfigured, getOwnerAddress, getPlan } from '@/lib/billing'

// Returns the plan params + the app's spender address. The client passes
// `owner` as subscriptionOwner when calling subscribe().
export async function GET() {
  if (!billingConfigured()) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })
  }

  const { priceUsdc, periodInDays, testnet } = getPlan()

  try {
    const owner = await getOwnerAddress()
    return NextResponse.json({ owner, priceUsdc, periodInDays, testnet })
  } catch (err) {
    console.error('[billing/plan] owner wallet error:', err)
    return NextResponse.json({ error: 'Could not resolve owner wallet' }, { status: 500 })
  }
}
