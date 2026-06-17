import { createPublicClient, http, parseAbiItem, parseUnits } from 'viem'
import { base } from 'wagmi/chains'
import { WatchItem } from './types'
import { updateWatchItem } from './store'

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
})

const MAX_BLOCK_LOOKBACK = 1000n

export interface MonitorResult {
  triggered: boolean
  item: WatchItem
  amount?: bigint
  direction?: 'in' | 'out'
  decimals: number
}

const DECIMALS_ABI = [parseAbiItem('function decimals() view returns (uint8)')]

// Cache token decimals across items/invocations — they never change for a token.
const decimalsCache = new Map<string, number>()

async function getTokenDecimals(tokenAddress: `0x${string}`): Promise<number> {
  const key = tokenAddress.toLowerCase()
  const cached = decimalsCache.get(key)
  if (cached !== undefined) return cached

  try {
    const decimals = await client.readContract({
      address: tokenAddress,
      abi: DECIMALS_ABI,
      functionName: 'decimals',
    })
    const n = Number(decimals)
    decimalsCache.set(key, n)
    return n
  } catch {
    // Non-standard token without decimals() — fall back to 18, don't cache the guess.
    return 18
  }
}

// thresholdEth is stored as a human-readable number; convert to base units for `decimals`.
function thresholdToBaseUnits(thresholdEth: number, decimals: number): bigint {
  return parseUnits(thresholdEth.toString(), decimals)
}

export async function checkWatchItem(item: WatchItem): Promise<MonitorResult> {
  if (item.type === 'native') return checkNative(item)
  return checkERC20(item)
}

async function checkNative(item: WatchItem): Promise<MonitorResult> {
  const address = item.watchedAddress as `0x${string}`
  const balance = await client.getBalance({ address })
  const lastBalance = item.lastBalanceWei ? BigInt(item.lastBalanceWei) : balance

  await updateWatchItem(item.id, { lastBalanceWei: balance.toString() })

  const diff = balance - lastBalance
  const absDiff = diff < 0n ? -diff : diff
  const thresholdWei = thresholdToBaseUnits(item.thresholdEth, 18)

  if (absDiff < thresholdWei) return { triggered: false, item, decimals: 18 }

  const direction = diff >= 0n ? 'in' : 'out'
  if (item.direction !== 'any' && item.direction !== direction) {
    return { triggered: false, item, decimals: 18 }
  }

  return { triggered: true, item, amount: absDiff, direction, decimals: 18 }
}

const TRANSFER_ABI = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
)

async function checkERC20(item: WatchItem): Promise<MonitorResult> {
  const tokenAddress = item.tokenAddress as `0x${string}`
  const watchedAddress = item.watchedAddress as `0x${string}`

  const decimals = await getTokenDecimals(tokenAddress)

  const latestBlock = await client.getBlockNumber()
  const fromBlock = item.lastCheckedBlock
    ? BigInt(item.lastCheckedBlock) + 1n
    : latestBlock > MAX_BLOCK_LOOKBACK
    ? latestBlock - MAX_BLOCK_LOOKBACK
    : 0n

  await updateWatchItem(item.id, { lastCheckedBlock: Number(latestBlock) })

  if (fromBlock > latestBlock) return { triggered: false, item, decimals }

  const [logsIn, logsOut] = await Promise.all([
    client.getLogs({
      address: tokenAddress,
      event: TRANSFER_ABI,
      args: { to: watchedAddress },
      fromBlock,
      toBlock: latestBlock,
    }),
    client.getLogs({
      address: tokenAddress,
      event: TRANSFER_ABI,
      args: { from: watchedAddress },
      fromBlock,
      toBlock: latestBlock,
    }),
  ])

  const thresholdWei = thresholdToBaseUnits(item.thresholdEth, decimals)

  let maxIn = 0n
  for (const log of logsIn) {
    const v = (log.args as { value: bigint }).value
    if (v > maxIn) maxIn = v
  }

  let maxOut = 0n
  for (const log of logsOut) {
    const v = (log.args as { value: bigint }).value
    if (v > maxOut) maxOut = v
  }

  if ((item.direction === 'in' || item.direction === 'any') && maxIn >= thresholdWei) {
    return { triggered: true, item, amount: maxIn, direction: 'in', decimals }
  }
  if ((item.direction === 'out' || item.direction === 'any') && maxOut >= thresholdWei) {
    return { triggered: true, item, amount: maxOut, direction: 'out', decimals }
  }

  return { triggered: false, item, decimals }
}
