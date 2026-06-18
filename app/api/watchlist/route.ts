import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getWatchItems, addWatchItem, removeWatchItem } from '@/lib/store'
import { getSessionAddress } from '@/lib/session'
import { WatchItem } from '@/lib/types'

export async function GET(req: NextRequest) {
  const userAddress = getSessionAddress(req)
  if (!userAddress) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  return NextResponse.json(await getWatchItems(userAddress))
}

export async function POST(req: NextRequest) {
  const userAddress = getSessionAddress(req)
  if (!userAddress) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = (await req.json()) as Partial<WatchItem>

  if (!body.watchedAddress || !body.type || !body.thresholdEth) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const item: WatchItem = {
    id: randomUUID(),
    userAddress, // from the verified session, never the client body
    watchedAddress: body.watchedAddress,
    label: body.label || body.watchedAddress.slice(0, 10),
    type: body.type,
    tokenAddress: body.tokenAddress,
    direction: body.direction || 'any',
    thresholdEth: body.thresholdEth,
    autoPost: body.autoPost ?? false,
    createdAt: new Date().toISOString(),
  }

  return NextResponse.json(await addWatchItem(item), { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const userAddress = getSessionAddress(req)
  if (!userAddress) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = (await req.json()) as { id: string }

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const ok = await removeWatchItem(id, userAddress)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
