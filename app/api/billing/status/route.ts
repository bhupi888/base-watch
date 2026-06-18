import { NextRequest, NextResponse } from 'next/server'
import { getSessionAddress } from '@/lib/session'
import { billingConfigured, billingEnforced, getPlan } from '@/lib/billing'
import { getActiveSubscription } from '@/lib/subscriptions'

// Tells the dashboard whether the current user has an active subscription, plus
// plan details for the upsell. `enforced` lets the UI decide whether to gate.
export async function GET(req: NextRequest) {
  const userAddress = getSessionAddress(req)
  if (!userAddress) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { priceUsdc, periodInDays } = getPlan()
  const sub = await getActiveSubscription(userAddress)

  return NextResponse.json({
    active: Boolean(sub),
    enforced: billingEnforced(),
    configured: billingConfigured(),
    plan: { priceUsdc, periodInDays },
    nextPeriodStart: sub?.nextPeriodStart ?? null,
  })
}
