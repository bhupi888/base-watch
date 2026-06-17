// Supabase-backed store. Same function shapes as before, now async (Promise-returning).
import { getSupabase, WATCHLIST_TABLE } from './supabase'
import { WatchItem } from './types'

// DB rows are snake_case; WatchItem is camelCase. Map at the boundary.
interface WatchRow {
  id: string
  user_address: string
  watched_address: string
  label: string
  type: WatchItem['type']
  token_address: string | null
  direction: WatchItem['direction']
  threshold_eth: number | string
  auto_post: boolean
  last_checked_block: number | null
  last_balance_wei: string | null
  created_at: string
}

function rowToItem(row: WatchRow): WatchItem {
  return {
    id: row.id,
    userAddress: row.user_address,
    watchedAddress: row.watched_address,
    label: row.label,
    type: row.type,
    tokenAddress: row.token_address ?? undefined,
    direction: row.direction,
    thresholdEth: Number(row.threshold_eth),
    autoPost: row.auto_post,
    lastCheckedBlock: row.last_checked_block ?? undefined,
    lastBalanceWei: row.last_balance_wei ?? undefined,
    createdAt: row.created_at,
  }
}

// Maps a partial WatchItem to a partial DB row, omitting undefined keys so PATCH/INSERT
// only touch the columns the caller provided.
function itemToRow(item: Partial<WatchItem>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (item.id !== undefined) row.id = item.id
  if (item.userAddress !== undefined) row.user_address = item.userAddress
  if (item.watchedAddress !== undefined) row.watched_address = item.watchedAddress
  if (item.label !== undefined) row.label = item.label
  if (item.type !== undefined) row.type = item.type
  if (item.tokenAddress !== undefined) row.token_address = item.tokenAddress
  if (item.direction !== undefined) row.direction = item.direction
  if (item.thresholdEth !== undefined) row.threshold_eth = item.thresholdEth
  if (item.autoPost !== undefined) row.auto_post = item.autoPost
  if (item.lastCheckedBlock !== undefined) row.last_checked_block = item.lastCheckedBlock
  if (item.lastBalanceWei !== undefined) row.last_balance_wei = item.lastBalanceWei
  if (item.createdAt !== undefined) row.created_at = item.createdAt
  return row
}

export async function getWatchItems(userAddress: string): Promise<WatchItem[]> {
  const { data, error } = await getSupabase().from(WATCHLIST_TABLE)
    .select('*')
    .ilike('user_address', userAddress)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getWatchItems: ${error.message}`)
  return (data as WatchRow[]).map(rowToItem)
}

export async function getAllWatchItems(): Promise<WatchItem[]> {
  const { data, error } = await getSupabase().from(WATCHLIST_TABLE).select('*')

  if (error) throw new Error(`getAllWatchItems: ${error.message}`)
  return (data as WatchRow[]).map(rowToItem)
}

export async function addWatchItem(item: WatchItem): Promise<WatchItem> {
  const { data, error } = await getSupabase().from(WATCHLIST_TABLE)
    .insert(itemToRow(item))
    .select('*')
    .single()

  if (error) throw new Error(`addWatchItem: ${error.message}`)
  return rowToItem(data as WatchRow)
}

export async function removeWatchItem(id: string, userAddress: string): Promise<boolean> {
  const { data, error } = await getSupabase().from(WATCHLIST_TABLE)
    .delete()
    .eq('id', id)
    .ilike('user_address', userAddress)
    .select('id')

  if (error) throw new Error(`removeWatchItem: ${error.message}`)
  return (data?.length ?? 0) > 0
}

export async function updateWatchItem(
  id: string,
  updates: Partial<WatchItem>,
): Promise<boolean> {
  const { data, error } = await getSupabase().from(WATCHLIST_TABLE)
    .update(itemToRow(updates))
    .eq('id', id)
    .select('id')

  if (error) throw new Error(`updateWatchItem: ${error.message}`)
  return (data?.length ?? 0) > 0
}
