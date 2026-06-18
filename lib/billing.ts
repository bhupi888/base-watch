// Server-side Base Pay subscription billing. Wraps @base-org/account's node
// payment SDK (CDP-backed). All CDP credentials are read by the SDK from env
// (CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET, optional PAYMASTER_URL).
//
// Never import this from a client component — it pulls in the Node CDP SDK.
import {
  charge,
  getOrCreateSubscriptionOwnerWallet,
  getSubscriptionStatus,
} from '@base-org/account/payment/node'

export interface BillingPlan {
  priceUsdc: string // string for the SDK, e.g. "5"
  periodInDays: number
  testnet: boolean
}

export function getPlan(): BillingPlan {
  return {
    priceUsdc: process.env.SUBSCRIPTION_PRICE_USDC || '5',
    periodInDays: Number(process.env.SUBSCRIPTION_PERIOD_DAYS || '30'),
    testnet: process.env.SUBSCRIPTION_TESTNET === 'true',
  }
}

// True once CDP credentials exist — required to derive the owner wallet and to
// charge. Without them the billing endpoints return 503 instead of crashing.
export function billingConfigured(): boolean {
  return Boolean(
    process.env.CDP_API_KEY_ID &&
      process.env.CDP_API_KEY_SECRET &&
      process.env.CDP_WALLET_SECRET,
  )
}

// When true, the monitor only processes watches for users with an active
// subscription. Default false so the app keeps working before billing is set up.
export function billingEnforced(): boolean {
  return process.env.BILLING_ENFORCED === 'true'
}

// The app's spender address that users grant a spend permission to. Cached:
// it's deterministic per CDP wallet and a network round-trip otherwise.
let cachedOwner: string | null = null

export async function getOwnerAddress(): Promise<string> {
  if (cachedOwner) return cachedOwner
  const { testnet } = getPlan()
  const owner = await getOrCreateSubscriptionOwnerWallet({ testnet })
  cachedOwner = owner.address
  return cachedOwner
}

export async function fetchSubscriptionStatus(id: string) {
  const { testnet } = getPlan()
  return getSubscriptionStatus({
    id,
    testnet,
    rpcUrl: process.env.BASE_RPC_URL,
  })
}

export async function chargeSubscription(id: string, amount: string) {
  const { testnet } = getPlan()
  return charge({
    id,
    amount,
    testnet,
    rpcUrl: process.env.BASE_RPC_URL,
  })
}
