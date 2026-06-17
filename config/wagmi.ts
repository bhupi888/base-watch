import { createConfig, cookieStorage, createStorage, http } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { coinbaseWallet, injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [base, baseSepolia],
  transports: {
    [base.id]: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
  connectors: [
    coinbaseWallet({
      appName: 'Base Watch',
      preference: 'smartWalletOnly',
    }),
    injected(),
  ],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
})
