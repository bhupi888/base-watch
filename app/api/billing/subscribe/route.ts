import { NextRequest, NextResponse } from 'next/server'
import { getSessionAddress } from '@/lib/session'
import {
  billingConfigured,
  fetchSubscriptionStatus,
  getOwnerAddress,
  getPlan,
} from '@/lib/billing'
import { upsertSubscription } from '@/lib/subscriptions'

interface SubscribeBody {
  id?: string // permission hash from the client's subscribe() call
}

// Persists a subscription the user just created in their wallet. We don't trust
// the client's claim: we re-read the on-chain status and confirm it's active and
// owned by THIS app's spender before recording it.
export async function POST(req: NextRequest) {
  const userAddress = getSessionAddress(req)
  if (!userAddress) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (!billingConfigured()) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })
  }

  const { id } = (await req.json()) as SubscribeBody
  if (!id) {
    return NextResponse.json({ error: 'Subscription id required' }, { status: 400 })
  }

  const status = await fetchSubscriptionStatus(id)
  if (!status.isSubscribed) {
    return NextResponse.json({ error: 'Subscription is not active on-chain' }, { status: 400 })
  }

  // The spender must be our wallet, otherwise this permission can't fund us.
  const owner = await getOwnerAddress()
  if (status.subscriptionOwner && status.subscriptionOwner.toLowerCase() !== owner.toLowerCase()) {
    return NextResponse.json({ error: 'Subscription owner mismatch' }, { status: 400 })
  }

  const { periodInDays, testnet } = getPlan()
  const sub = await upsertSubscription({
    id,
    userAddress, // from the verified session
    subscriptionOwner: owner,
    recurringCharge: Number(status.recurringCharge),
    periodInDays: status.periodInDays ?? periodInDays,
    status: 'active',
    testnet,
    nextPeriodStart: status.nextPeriodStart
      ? new Date(status.nextPeriodStart).toISOString()
      : undefined,
    createdAt: new Date().toISOString(),
  })

  return NextResponse.json(sub, { status: 201 })
}
