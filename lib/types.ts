export type WatchDirection = 'any' | 'in' | 'out'
export type WatchType = 'native' | 'erc20'

export interface WatchItem {
  id: string
  userAddress: string       // wallet that created this watch
  watchedAddress: string    // address to monitor
  label: string
  type: WatchType
  tokenAddress?: string     // only for erc20
  direction: WatchDirection
  thresholdEth: number      // threshold in human units (ETH, or token units — monitor resolves decimals per token)
  autoPost: boolean
  // monitor bookkeeping
  lastCheckedBlock?: number
  lastBalanceWei?: string   // string so BigInt survives JSON round-trip
  createdAt: string
}

export type SubscriptionStatus = 'active' | 'canceled'

export interface Subscription {
  id: string                // permission hash from subscribe()
  userAddress: string       // subscriptionPayer — the wallet being charged
  subscriptionOwner: string // app spender (CDP smart wallet) address
  recurringCharge: number   // USDC per period
  periodInDays: number
  status: SubscriptionStatus
  testnet: boolean
  lastChargedAt?: string
  nextPeriodStart?: string
  createdAt: string
}
