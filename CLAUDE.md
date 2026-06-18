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
lib/store.ts              Storage layer (Supabase) — async CRUD over the watchlist table
lib/supabase.ts           Server-side Supabase client (service-role key, bypasses RLS)
lib/monitor.ts            Onchain checker (ETH balance diff + ERC-20 Transfer logs)
lib/notifications.ts      Base Dashboard Notifications API wrapper
lib/chain.ts              Shared viem public client (Base mainnet) — monitor + SIWE verify
lib/session.ts            HMAC-signed session tokens + cookie/auth helpers
app/providers.tsx         wagmi + React Query providers
app/layout.tsx            Root layout
app/page.tsx              Auth flow: ConnectWallet → SIWE → Dashboard (restores session via /api/auth/me)
components/ConnectWallet  Handles all 4 wagmi connection states
components/SignIn         SIWE sign-in (nonce → sign → server verify)
components/WatchlistForm  Add a watch
components/WatchlistTable List + remove watches
app/api/auth/nonce/       GET — issues a one-time SIWE nonce in an HttpOnly cookie
app/api/auth/verify/      POST — verifies SIWE signature (EIP-1271/6492), sets session cookie
app/api/auth/me/          GET — returns the session address (or 401)
app/api/auth/logout/      POST — clears the session cookie
app/api/watchlist/        GET / POST / DELETE — userAddress derived from session, not client
app/api/cron/check/       Bearer-protected cron endpoint — polls chain, sends alerts
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
BASE_NOTIFICATIONS_API_KEY=   # from dashboard.base.org
NEXT_PUBLIC_APP_URL=          # your Vercel deployment URL
CRON_SECRET=                  # any random secret string
SESSION_SECRET=               # signs SIWE session cookies; falls back to CRON_SECRET
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

## Store (Supabase)

`lib/store.ts` is backed by Supabase via `lib/supabase.ts` (server-side client using the
service-role key). The five store functions (`getWatchItems`, `getAllWatchItems`,
`addWatchItem`, `removeWatchItem`, `updateWatchItem`) are **async** — callers must `await`.
DB columns are snake_case and mapped to/from the camelCase `WatchItem` at the store boundary.

RLS is enabled on `watchlist` with no public policies, so only the service-role key (server)
can read/write — the anon/publishable key cannot. The migration has already been applied to the
"Bhupi project 1" Supabase project (`fnilovtdogzfipxdfpdj`).

## Known stubs (not yet built)

1. **Base Pay billing** — needs a CDP server wallet. See `@base-org/account` payment exports.
2. **Auto-post to Base App feed** — `autoPost` field exists in data model; endpoint not wired.

### Resolved

- **Server-side SIWE** — auth is now verified server-side. Flow: client GETs `/api/auth/nonce`
  (one-time nonce in an HttpOnly cookie) → signs the SIWE message → POSTs `{ message, signature }`
  to `/api/auth/verify`, which validates the nonce/domain and verifies the signature on-chain via
  `verifySiweMessage` (supports EIP-1271/6492 smart wallets — Base App uses smart wallets). On
  success it sets a 7-day HMAC-signed session cookie (`bw_session`, `lib/session.ts`).
  `/api/watchlist` derives `userAddress` from that session (`getSessionAddress`) and 401s without
  it — the client can no longer spoof another user's address. `/api/auth/me` restores a session on
  load; `/api/auth/logout` clears it. Signing key is `SESSION_SECRET` (falls back to `CRON_SECRET`).
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
