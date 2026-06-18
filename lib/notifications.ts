// Typed wrapper around the Base Notifications API (Base Dashboard).
// Docs: https://docs.base.org/apps/technical-guides/base-notifications
// Auth: x-api-key header. Limits: title ≤30, message ≤200, 20 req/min per IP.
//
// Notifications go to wallet addresses that have pinned this app AND enabled
// notifications in the Base App. `app_url` must match the registered app URL.

const API_KEY = process.env.BASE_NOTIFICATIONS_API_KEY || ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''
const BASE_API = 'https://dashboard.base.org/api/v1'

// Both the key and the registered app URL are required to send. Without them we
// no-op so the rest of the cron keeps working unconfigured.
export function notificationsConfigured(): boolean {
  return Boolean(API_KEY && APP_URL)
}

export async function sendNotification(
  addresses: string[],
  title: string,
  message: string,
  targetPath?: string,
): Promise<void> {
  if (!notificationsConfigured()) {
    console.warn('[notifications] BASE_NOTIFICATIONS_API_KEY / NEXT_PUBLIC_APP_URL not set — skipping')
    return
  }

  const res = await fetch(`${BASE_API}/notifications/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      app_url: APP_URL,
      wallet_addresses: addresses,
      title: title.slice(0, 30),
      message: message.slice(0, 200),
      ...(targetPath ? { target_path: targetPath } : {}),
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Notification API error ${res.status}: ${body}`)
  }
}

interface AppUser {
  address: string
  notificationsEnabled: boolean
}

interface AppUsersResponse {
  success?: boolean
  users?: AppUser[]
  nextCursor?: string
}

// All wallet addresses that pinned this app with notifications enabled.
// Paginates via cursor; filters server-side and again client-side to be safe.
export async function getOptedInUsers(): Promise<string[]> {
  if (!notificationsConfigured()) return []

  const addresses: string[] = []
  let cursor: string | undefined

  do {
    const url = new URL(`${BASE_API}/notifications/app/users`)
    url.searchParams.set('app_url', APP_URL)
    url.searchParams.set('notification_enabled', 'true')
    url.searchParams.set('limit', '1000')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url, { headers: { 'x-api-key': API_KEY } })
    if (!res.ok) break

    const data = (await res.json()) as AppUsersResponse
    for (const u of data.users ?? []) {
      if (u.notificationsEnabled) addresses.push(u.address)
    }
    cursor = data.nextCursor || undefined
  } while (cursor)

  return addresses
}

interface UserStatusResponse {
  appPinned?: boolean
  notificationsEnabled?: boolean
}

export async function getUserNotificationStatus(address: string): Promise<boolean> {
  if (!notificationsConfigured()) return false

  const res = await fetch(`${BASE_API}/notifications/app/user/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ app_url: APP_URL, wallet_address: address }),
  })

  if (!res.ok) return false
  const data = (await res.json()) as UserStatusResponse
  return Boolean(data.notificationsEnabled)
}
