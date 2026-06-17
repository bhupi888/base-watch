# Base Watch

Onchain wallet monitoring app native to Base App (Coinbase's mobile "everything app").

## What it does

Users connect their wallet, add addresses/tokens to watch with movement thresholds, and receive push notifications **inside Base App** when a watched address moves more than the threshold. Billing via Base Pay USDC subscriptions.

## Stack

- **Framework:** Next.js 15 App Router + TypeScript + Tailwind CSS
- **Web3:** wagmi v3 + viem + @base-org/account
- **Auth:** Sign-In with Ethereum (SIWE) via wagmi's `useSignMessage`
- **Data:** Supabase (Postgres) — see migration below
- **Hosting:** Vercel (cron every 5 min via `vercel.json`)
- **Notifications:** Base Dashboard Notifications API

## Project structure

```
config/wagmi.ts           wagmi v3 config — Base mainnet + Sepolia
lib/types.ts              WatchItem type
lib/store.ts              Storage layer (swap JSON file → Supabase here)
lib/monitor.ts            Onchain checker (ETH balance diff + ERC-20 Transfer logs)
lib/notifications.ts      Base Dashboard Notifications API wrapper
app/providers.tsx         wagmi + React Query providers
app/layout.tsx            Root layout
app/page.tsx              Auth flow: ConnectWallet → SIWE → Dashboard
components/ConnectWallet  Handles all 4 wagmi connection states
components/SignIn         SIWE sign-in
components/WatchlistForm  Add a watch
components/WatchlistTable List + remove watches
app/api/watchlist/        GET / POST / DELETE watchlist items
app/api/cron/check/       Bearer-protected cron endpoint — polls chain, sends alerts
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
BASE_NOTIFICATIONS_API_KEY=   # from dashboard.base.org
NEXT_PUBLIC_APP_URL=          # your Vercel deployment URL
CRON_SECRET=                  # any random secret string
BASE_RPC_URL=                 # optional, falls back to https://mainnet.base.org
```

For Supabase, also add:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # for server-side store operations
```

## Supabase migration

Run this SQL in your Supabase project's SQL editor:

```sql
create table watchlist (
  id uuid primary key default gen_random_uuid(),
  user_address text not null,
  watched_address text not null,
  label text not null,
  type text not null check (type in ('native', 'erc20')),
  token_address text,
  direction text not null default 'any' check (direction in ('any', 'in', 'out')),
  threshold_eth numeric not null,
  auto_post boolean not null default false,
  last_checked_block bigint,
  last_balance_wei text,
  created_at timestamptz not null default now()
);

create index watchlist_user_address_idx on watchlist (lower(user_address));
```

## Swapping the store to Supabase

`lib/store.ts` currently uses a local JSON file. To switch to Supabase:
1. Install: `npm install @supabase/supabase-js`
2. Replace the functions in `lib/store.ts` with Supabase client calls (same function signatures — nothing else in the codebase needs to change)

## Known stubs (not yet built)

1. **Base Pay billing** — needs a CDP server wallet. See `@base-org/account` payment exports.
2. **Auto-post to Base App feed** — `autoPost` field exists in data model; endpoint not wired.
3. **Server-side SIWE** — currently verified client-side only. For production, POST the signature to `/api/auth/verify` and issue a server session.

### Resolved

- **Token decimals** — `lib/monitor.ts` now resolves each ERC-20's `decimals()` via RPC (cached), so non-18-decimal tokens like USDC (6) compute thresholds and amounts correctly.

## Testing Base App features

Base App is **mobile-only**. To test wallet connect, notifications, and feed:
1. Run `npm run dev` locally
2. Expose via ngrok: `ngrok http 3000`
3. Open the ngrok URL on your Android phone in Base App

## Deployment

```bash
npm i -g vercel        # if not installed
vercel                 # preview deploy
vercel --prod          # production deploy
```

Set `CRON_SECRET` on Vercel and add it to the cron request header in `vercel.json` if you want the endpoint protected in production.

## Base Dashboard registration

Required to get a notifications API key:
1. Go to dashboard.base.org
2. Register your app (name, icon, tagline, screenshots, category, primary URL)
3. Copy the API key → `BASE_NOTIFICATIONS_API_KEY`
