'use client'

import { WatchItem } from '@/lib/types'

interface WatchlistTableProps {
  items: WatchItem[]
  onRemoved: () => void
}

export function WatchlistTable({ items, onRemoved }: WatchlistTableProps) {
  async function handleRemove(id: string) {
    await fetch('/api/watchlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    onRemoved()
  }

  if (items.length === 0) {
    return (
      <p className="text-gray-500 text-sm text-center py-8">
        No watches yet. Add one above.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
            <th className="pb-2 pr-4 font-medium">Label</th>
            <th className="pb-2 pr-4 font-medium">Address</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 pr-4 font-medium">Direction</th>
            <th className="pb-2 pr-4 font-medium">Threshold</th>
            <th className="pb-2 font-medium">Auto-post</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-900/50 transition-colors">
              <td className="py-3 pr-4">{item.label}</td>
              <td className="py-3 pr-4 font-mono text-xs text-gray-400">
                {item.watchedAddress.slice(0, 8)}…{item.watchedAddress.slice(-6)}
              </td>
              <td className="py-3 pr-4 capitalize">{item.type}</td>
              <td className="py-3 pr-4 capitalize">{item.direction}</td>
              <td className="py-3 pr-4">
                {item.thresholdEth} {item.type === 'native' ? 'ETH' : 'tokens'}
              </td>
              <td className="py-3 pr-4">{item.autoPost ? '✓' : '—'}</td>
              <td className="py-3 text-right">
                <button
                  onClick={() => handleRemove(item.id)}
                  className="text-xs text-red-500 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
