import { createPublicClient, http } from 'viem'
import { base } from 'wagmi/chains'

// Shared read-only client for Base mainnet. Used by the monitor (balance/log reads)
// and by SIWE verification (EIP-1271/6492 smart-wallet signature checks).
export const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
})
