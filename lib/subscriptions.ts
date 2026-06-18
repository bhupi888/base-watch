// Supabase-backed store for subscriptions, mirroring lib/store.ts conventions:
// async CRUD, snake_case rows mapped to/from the camelCase Subscription type.
import { getSupabase, SUBSCRIPTIONS_TABLE } from './supabase'
import { Subscription } from './types'

interface SubscriptionRow {
  id: string
  user_address: string
  subscription_owner: string
  recurring_charge: number | string
  period_in_days: number
  status: Subscription['status']
  testnet: boolean
  last_charged_at: string | null
  next_period_start: string | null
  created_at: string
}

function rowToSub(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userAddress: row.user_address,
    subscriptionOwner: row.subscription_owner,
    recurringCharge: Number(row.recurring_charge),
    periodInDays: row.period_in_days,
    status: row.status,
    testnet: row.testnet,
    lastChargedAt: row.last_charged_at ?? undefined,
    nextPeriodStart: row.next_period_start ?? undefined,
    createdAt: row.created_at,
  }
}

function subToRow(sub: Partial<Subscription>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (sub.id !== undefined) row.id = sub.id
  if (sub.userAddress !== undefined) row.user_address = sub.userAddress
  if (sub.subscriptionOwner !== undefined) row.subscription_owner = sub.subscriptionOwner
  if (sub.recurringCharge !== undefined) row.recurring_charge = sub.recurringCharge
  if (sub.periodInDays !== undefined) row.period_in_days = sub.periodInDays
  if (sub.status !== undefined) row.status = sub.status
  if (sub.testnet !== undefined) row.testnet = sub.testnet
  if (sub.lastChargedAt !== undefined) row.last_charged_at = sub.lastChargedAt
  if (sub.nextPeriodStart !== undefined) row.next_period_start = sub.nextPeriodStart
  if (sub.createdAt !== undefined) row.created_at = sub.createdAt
  return row
}

// The latest active subscription for a user, or null. One active sub per user is
// expected; we take the most recent if duplicates ever exist.
export async function getActiveSubscription(userAddress: string): Promise<Subscription | null> {
  const { data, error } = await getSupabase().from(SUBSCRIPTIONS_TABLE)
    .select('*')
    .ilike('user_address', userAddress)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw new Error(`getActiveSubscription: ${error.message}`)
  const rows = data as SubscriptionRow[]
  return rows.length ? rowToSub(rows[0]) : null
}

export async function getAllActiveSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await getSupabase().from(SUBSCRIPTIONS_TABLE)
    .select('*')
    .eq('status', 'active')

  if (error) throw new Error(`getAllActiveSubscriptions: ${error.message}`)
  return (data as SubscriptionRow[]).map(rowToSub)
}

// Insert or replace by id (the permission hash is the natural key).
export async function upsertSubscription(sub: Subscription): Promise<Subscription> {
  const { data, error } = await getSupabase().from(SUBSCRIPTIONS_TABLE)
    .upsert(subToRow(sub))
    .select('*')
    .single()

  if (error) throw new Error(`upsertSubscription: ${error.message}`)
  return rowToSub(data as SubscriptionRow)
}

export async function updateSubscription(
  id: string,
  updates: Partial<Subscription>,
): Promise<boolean> {
  const { data, error } = await getSupabase().from(SUBSCRIPTIONS_TABLE)
    .update(subToRow(updates))
    .eq('id', id)
    .select('id')

  if (error) throw new Error(`updateSubscription: ${error.message}`)
  return (data?.length ?? 0) > 0
}
