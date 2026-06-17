import { NextRequest, NextResponse } from 'next/server'
import { getAllWatchItems } from '@/lib/store'
import { checkWatchItem } from '@/lib/monitor'
import { sendNotification, getUserNotificationStatus } from '@/lib/notifications'
import { formatUnits } from 'viem'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const items = getAllWatchItems()
  if (items.length === 0) return NextResponse.json({ checked: 0, triggered: 0 })

  const results = await Promise.allSettled(items.map(checkWatchItem))

  // Group triggers by user address
  const byUser = new Map<string, string[]>()

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[cron/check] item error:', result.reason)
      continue
    }
    const { triggered, item, amount, direction, decimals } = result.value
    if (!triggered || amount === undefined) continue

    const msgs = byUser.get(item.userAddress) ?? []
    const ethAmount = parseFloat(formatUnits(amount, decimals)).toFixed(4)
    const dir = direction === 'in' ? 'received' : 'sent'
    msgs.push(`${item.label}: ${dir} ${ethAmount} ${item.type === 'native' ? 'ETH' : 'tokens'}`)
    byUser.set(item.userAddress, msgs)
  }

  let notified = 0
  for (const [address, msgs] of byUser) {
    const optedIn = await getUserNotificationStatus(address)
    if (!optedIn) continue

    const message = msgs.join(' | ').slice(0, 200)
    await sendNotification([address], 'Base Watch Alert', message)
    notified++
  }

  const triggered = Array.from(byUser.keys()).length

  return NextResponse.json({
    checked: items.length,
    triggered,
    notified,
  })
}
