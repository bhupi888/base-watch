'use client'

import { useAccount, useConnect, useDisconnect, useReconnect } from 'wagmi'
import { useEffect } from 'react'

export function ConnectWallet({ children }: { children: React.ReactNode }) {
  const { address, status } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { reconnect } = useReconnect()

  // Restore session on mount
  useEffect(() => {
    reconnect()
  }, [reconnect])

  if (status === 'connecting' || status === 'reconnecting') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400 text-sm">Connecting wallet…</p>
      </div>
    )
  }

  if (status === 'disconnected') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Base Watch</h1>
        <p className="text-gray-400 text-sm">Connect your wallet to get started</p>
        <div className="flex flex-col gap-2 w-64">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 px-4 text-sm font-medium transition-colors"
            >
              {connector.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // status === 'connected'
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-sm">Base Watch</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 font-mono">
            {address?.slice(0, 6)}…{address?.slice(-4)}
          </span>
          <button
            onClick={() => disconnect()}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </header>
      {children}
    </div>
  )
}
