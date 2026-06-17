// Local-dev JSON file store. Drop-in-replaceable with Supabase — same function signatures.
import fs from 'fs'
import path from 'path'
import { WatchItem } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'watchlist.json')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readAll(): WatchItem[] {
  ensureDir()
  if (!fs.existsSync(DATA_FILE)) return []
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as WatchItem[]
}

function writeAll(items: WatchItem[]) {
  ensureDir()
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2))
}

export function getWatchItems(userAddress: string): WatchItem[] {
  return readAll().filter(
    (i) => i.userAddress.toLowerCase() === userAddress.toLowerCase(),
  )
}

export function getAllWatchItems(): WatchItem[] {
  return readAll()
}

export function addWatchItem(item: WatchItem): WatchItem {
  const items = readAll()
  items.push(item)
  writeAll(items)
  return item
}

export function removeWatchItem(id: string, userAddress: string): boolean {
  const items = readAll()
  const idx = items.findIndex(
    (i) => i.id === id && i.userAddress.toLowerCase() === userAddress.toLowerCase(),
  )
  if (idx === -1) return false
  items.splice(idx, 1)
  writeAll(items)
  return true
}

export function updateWatchItem(id: string, updates: Partial<WatchItem>): boolean {
  const items = readAll()
  const idx = items.findIndex((i) => i.id === id)
  if (idx === -1) return false
  items[idx] = { ...items[idx], ...updates }
  writeAll(items)
  return true
}
