// Server-side Supabase client. Uses the service-role key, which bypasses RLS —
// never import this from client components.
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const WATCHLIST_TABLE = 'watchlist'
export const SUBSCRIPTIONS_TABLE = 'subscriptions'

let client: SupabaseClient | null = null

// Lazy singleton: don't read env / construct at import time, so route modules can be
// imported during `next build` without the service-role key being present. The client is
// created on first actual use (inside a request handler), where env vars are available.
export function getSupabase(): SupabaseClient {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    )
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}
