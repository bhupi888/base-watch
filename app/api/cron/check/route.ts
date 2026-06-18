import { NextRequest, NextResponse } from 'next/server'
import { getAllWatchItems } from '@/lib/store'
import { checkWatchItem } from '@/lib/monitor'
import { sendNotification, getUserNotificationStatus } from '@/lib/notifications'
import { postCast, feedPostingEnabled } from '@/lib/feed'
import { billingEnforced } from '@/lib/billing'
import { getAllActiveSubscriptions } from '@/lib/subscriptions'
import { formatUnits } from 'viem'

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let items = await getAllWatchItems()

  // When billing is enforced, only monitor watches owned by subscribed users.
  if (billingEnforced()) {
    const subs = await getAllActiveSubscriptions()
    const paid = new Set(subs.map((s) => s.userAddress.toLowerCase()))
    items = items.filter((item) => paid.has(item.userAddress.toLowerCase()))
  }

  if (items.length === 0) return NextResponse.json({ checked: 0, triggered: 0 })

  const results = await Promise.allSettled(items.map(checkWatchItem))

  // Group push-notification lines by user address; collect public casts separately.
  const byUser = new Map<string, string[]>()
  const casts: { text: string; idem: string }[] = []

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[cron/check] item error:', result.reason)
      continue
    }
    const { triggered, item, amount, direction, decimals } = result.value
    if (!triggered || amount === undefined) continue

    const ethAmount = parseFloat(formatUnits(amount, decimals)).toFixed(4)
    const asset = item.type === 'native' ? 'ETH' : 'tokens'
    const dir = direction === 'in' ? 'received' : 'sent'

    const msgs = byUser.get(item.userAddress) ?? []
    msgs.push(`${item.label}: ${dir} ${ethAmount} ${asset}`)
    byUser.set(item.userAddress, msgs)

    // Opt-in public alert from the Base Watch account (no private label leaked).
    if (item.autoPost) {
      casts.push({
        text: `🐋 Whale alert: ${shortAddress(item.watchedAddress)} ${dir} ${ethAmount} ${asset} on Base 👀`,
        idem: `${item.id}-${item.lastCheckedBlock ?? ''}-${amount.toString()}`,
      })
    }
  }

  let notified = 0
  for (const [address, msgs] of byUser) {
    const optedIn = await getUserNotificationStatus(address)
    if (!optedIn) continue

    const message = msgs.join(' | ').slice(0, 200)
    await sendNotification([address], 'Base Watch Alert', message)
    notified++
  }

  // Post opt-in public alerts from the app's Farcaster account.
  let posted = 0
  if (feedPostingEnabled()) {
    for (const cast of casts) {
      try {
        await postCast(cast.text, cast.idem)
        posted++
      } catch (err) {
        console.error('[cron/check] cast error:', err)
      }
    }
  }

  const triggered = Array.from(byUser.keys()).length

  return NextResponse.json({
    checked: items.length,
    triggered,
    notified,
    posted,
  })
}
