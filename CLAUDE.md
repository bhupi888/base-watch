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
lib/feed.ts               Auto-post whale alerts to Farcaster feed (app account, via Neynar)
lib/billing.ts            Base Pay subscriptions (CDP node SDK) — owner wallet, charge, status
lib/subscriptions.ts      Storage layer (Supabase) — async CRUD over the subscriptions table
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
app/api/billing/plan/     GET — app spender address + plan params (for client subscribe)
app/api/billing/subscribe POST — verifies a new subscription on-chain, persists it
app/api/billing/status/   GET — current user's subscription state (for the dashboard)
app/api/watchlist/        GET / POST / DELETE — userAddress derived from session, not client
app/api/cron/check/       Bearer-protected cron — polls chain, sends alerts (gated by billing)
app/api/cron/charge/      Bearer-protected cron — charges due subscriptions (hourly)
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
BASE_NOTIFICATIONS_API_KEY=   # from dashboard.base.org
NEXT_PUBLIC_APP_URL=          # your Vercel deployment URL
CRON_SECRET=                  # any random secret string
SESSION_SECRET=               # signs SIWE session cookies; falls back to CRON_SECRET
BASE_RPC_URL=                 # optional, falls back to https://mainnet.base.org
NEYNAR_API_KEY=               # optional, enables auto-post to feed (with signer below)
NEYNAR_SIGNER_UUID=           # optional, the app's approved Farcaster signer
CDP_API_KEY_ID=               # Base Pay billing — CDP credentials (portal.cdp.coinbase.com)
CDP_API_KEY_SECRET=
CDP_WALLET_SECRET=
PAYMASTER_URL=                # optional, sponsors gas for charges
SUBSCRIPTION_PRICE_USDC=5     # optional, default 5
SUBSCRIPTION_PERIOD_DAYS=30   # optional, default 30
SUBSCRIPTION_TESTNET=false    # optional, true = Base Sepolia
BILLING_ENFORCED=false        # optional, true = only monitor subscribed users
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

create table subscriptions (
  id text primary key,                                  -- permission hash from subscribe()
  user_address text not null,                           -- subscriptionPayer (wallet charged)
  subscription_owner text not null,                     -- app spender (CDP smart wallet)
  recurring_charge numeric not null,
  period_in_days integer not null default 30,
  status text not null default 'active' check (status in ('active', 'canceled')),
  testnet boolean not null default false,
  last_charged_at timestamptz,
  next_period_start timestamptz,
  created_at timestamptz not null default now()
);

create index subscriptions_user_address_idx on subscriptions (lower(user_address));
create index subscriptions_status_idx on subscriptions (status);

alter table subscriptions enable row level security;
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

_(none — see Resolved below. Production config still required: see "Remaining production setup".)_

### Resolved

- **Base Pay billing** — USDC subscriptions via `@base-org/account` spend permissions.
  Client (`components/Subscribe.tsx`) GETs `/api/billing/plan` for the app's spender address +
  plan, calls the SDK's `subscribe()` (browser) to grant a recurring spend permission, then POSTs
  the permission hash to `/api/billing/subscribe`, which re-reads on-chain status to confirm it's
  active and owned by our spender before persisting (no trusting the client). `lib/billing.ts`
  wraps the node SDK (`getOrCreateSubscriptionOwnerWallet`, `charge`, `getSubscriptionStatus`)
  using CDP creds from env. `/api/cron/charge` (hourly) charges due subscriptions once per period;
  `/api/cron/check` skips unsubscribed users when `BILLING_ENFORCED=true`. All billing endpoints
  503 gracefully until CDP creds are set, so the app runs unbilled by default. Plan/period/testnet
  are env-configurable. Subscriptions persist in the `subscriptions` table (migration above).
- **Auto-post to Base App feed** — Base App's feed is Farcaster; there is no first-party
  "post to a user's feed" API, and casting on a user's behalf would require a per-user signer.
  Instead, watches flagged `autoPost` now trigger a public whale-alert cast from the *app's own*
  Farcaster account (`lib/feed.ts` → Neynar `publish-cast`), wired into `app/api/cron/check`.
  Casts use the watched address (never the user's private label) and an `idem` key to avoid
  double-posting on re-runs. Enabled only when `NEYNAR_API_KEY` + `NEYNAR_SIGNER_UUID` are set
  (otherwise it no-ops, like notifications). Per-user signer-authorized posting remains a future
  option if needed.
- **Server-side SIWE** — auth is now verified server-side. Flow: client GETs `/api/auth/nonce`
  (one-time nonce in an HttpOnly cookie) → signs the SIWE message → POSTs `{ message, signature }`
  to `/api/auth/verify`, which validates the nonce/domain and verifies the signature on-chain via
  `verifySiweMessage` (supports EIP-1271/6492 smart wallets — Base App uses smart wallets). On
  success it sets a 7-day HMAC-signed session cookie (`bw_session`, `lib/session.ts`).
  `/api/watchlist` derives `userAddress` from that session (`getSessionAddress`) and 401s without
  it — the client can no longer spoof another user's address. `/api/auth/me` restores a session on
  load; `/api/auth/logout` clears it. Signing key is `SESSION_SECRET` (falls back to `CRON_SECRET`).
- **Token decimals** — `lib/monitor.ts` now resolves each ERC-20's `decimals()` via RPC (cached), so non-18-decimal tokens like USDC (6) compute thresholds and amounts correctly.

## Remaining production setup

The code is feature-complete; these are operational config steps, not code:

1. **`SUPABASE_SERVICE_ROLE_KEY`** — currently blank in `.env.local`; the store can't read/write
   without it, so the app is non-functional locally until it's set.
2. **`SESSION_SECRET`** on Vercel (only a dev value exists locally).
3. **`BASE_NOTIFICATIONS_API_KEY`** — register the app at dashboard.base.org (push notifications).
4. **Neynar** `NEYNAR_API_KEY` + `NEYNAR_SIGNER_UUID` to enable feed auto-post (optional).
5. **CDP** `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` / `CDP_WALLET_SECRET` to enable billing; flip
   `BILLING_ENFORCED=true` once ready to gate. Test on Base Sepolia first (`SUBSCRIPTION_TESTNET=true`).
6. **Real device test** — smart-wallet SIWE and Base Pay subscribe must be tested in Base App on a
   phone (via ngrok); they can't be exercised from a desktop browser.

## Testing Base App features

Base App is **mobile-only**. To test wallet connect, notifications, and feed:
1. Run `npm run dev` locally
2. Expose via ngrok: `ngrok http 3000`
3. Open the ngrok URL on your Android phone in Base App

## Deployment

**Live:** https://base-watch-vert.vercel.app — Vercel project `base-watch`
(`prj_ADIfb0kOdxwXmKt3ZanfthD2aMJC`, team "bhupi's projects"), connected to the GitHub repo
`bhupi888/base-watch`. Env vars (Supabase URL/anon/service-role, `SESSION_SECRET`, `CRON_SECRET`,
`BASE_RPC_URL`, `NEXT_PUBLIC_APP_URL`) are set for Production + Preview. Notifications/CDP/Neynar
are not set yet, so those features no-op.

```bash
npm i -g vercel        # if not installed
vercel                 # preview deploy
vercel --prod          # production deploy
```

**Cron caveat:** Vercel's Hobby (free) plan only allows cron jobs once per day, so `vercel.json`
runs `/api/cron/check` and `/api/cron/charge` daily (09:00 / 10:00 UTC). For real-time (5-min)
monitoring, either upgrade to Vercel Pro and restore `*/5 * * * *`, or point an external scheduler
(e.g. cron-job.org) at `/api/cron/check` with the `Authorization: Bearer $CRON_SECRET` header.

`CRON_SECRET` is set on Vercel; the cron endpoints check it via the `Authorization` header
(Vercel's scheduler sends it automatically for native crons).

## Base Dashboard registration

Required to get a notifications API key:
1. Go to dashboard.base.org
2. Register your app (name, icon, tagline, screenshots, category, primary URL)
3. Copy the API key → `BASE_NOTIFICATIONS_API_KEY`
