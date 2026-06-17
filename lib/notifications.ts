// Typed wrapper around the Base Dashboard Notifications REST API.
// Docs: docs.base.org/apps/technical-guides/base-notifications
// Rate limit: 20 req/min. Title ≤30 chars, message ≤200 chars.

const API_KEY = process.env.BASE_NOTIFICATIONS_API_KEY || ''
const BASE_API = 'https://api.wallet.coinbase.com/rpc/v3/developers/base'

export async function sendNotification(
  addresses: string[],
  title: string,
  message: string,
): Promise<void> {
  if (!API_KEY) {
    console.warn('[notifications] BASE_NOTIFICATIONS_API_KEY not set — skipping')
    return
  }

  const res = await fetch(`${BASE_API}/notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      targetAddresses: addresses,
      title: title.slice(0, 30),
      message: message.slice(0, 200),
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Notification API error ${res.status}: ${body}`)
  }
}

export async function getOptedInUsers(): Promise<string[]> {
  if (!API_KEY) return []

  const res = await fetch(`${BASE_API}/notifications/users`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  })

  if (!res.ok) return []
  const data = (await res.json()) as { addresses?: string[] }
  return data.addresses ?? []
}

export async function getUserNotificationStatus(address: string): Promise<boolean> {
  if (!API_KEY) return false

  const res = await fetch(
    `${BASE_API}/notifications/users/${address}`,
    { headers: { Authorization: `Bearer ${API_KEY}` } },
  )

  if (!res.ok) return false
  const data = (await res.json()) as { optedIn?: boolean }
  return data.optedIn ?? false
}
