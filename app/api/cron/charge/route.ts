import { NextRequest, NextResponse } from 'next/server'
import { getAllActiveSubscriptions, updateSubscription } from '@/lib/subscriptions'
import { billingConfigured, chargeSubscription, fetchSubscriptionStatus } from '@/lib/billing'

// Bearer-protected billing cron. Charges each active subscription once per
// period against its spend permission. Mirrors the auth of /api/cron/check.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!billingConfigured()) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })
  }

  const subs = await getAllActiveSubscriptions()
  let charged = 0
  let canceled = 0

  for (const sub of subs) {
    try {
      const status = await fetchSubscriptionStatus(sub.id)

      // Permission revoked/expired on-chain — stop tracking it.
      if (!status.isSubscribed) {
        await updateSubscription(sub.id, { status: 'canceled' })
        canceled++
        continue
      }

      // Skip if nothing is chargeable this period, or we already charged it.
      const remaining = Number(status.remainingChargeInPeriod ?? '0')
      const alreadyChargedThisPeriod =
        sub.lastChargedAt &&
        status.currentPeriodStart &&
        new Date(sub.lastChargedAt) >= new Date(status.currentPeriodStart)
      if (remaining <= 0 || alreadyChargedThisPeriod) continue

      await chargeSubscription(sub.id, 'max-remaining-charge')
      charged++

      const refreshed = await fetchSubscriptionStatus(sub.id)
      await updateSubscription(sub.id, {
        lastChargedAt: new Date().toISOString(),
        nextPeriodStart: refreshed.nextPeriodStart
          ? new Date(refreshed.nextPeriodStart).toISOString()
          : undefined,
      })
    } catch (err) {
      console.error(`[cron/charge] sub ${sub.id} error:`, err)
    }
  }

  return NextResponse.json({ active: subs.length, charged, canceled })
}
