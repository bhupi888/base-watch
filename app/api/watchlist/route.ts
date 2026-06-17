import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getWatchItems, addWatchItem, removeWatchItem } from '@/lib/store'
import { WatchItem } from '@/lib/types'

export async function GET(req: NextRequest) {
  const userAddress = req.nextUrl.searchParams.get('userAddress')
  if (!userAddress) {
    return NextResponse.json({ error: 'userAddress required' }, { status: 400 })
  }
  return NextResponse.json(getWatchItems(userAddress))
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<WatchItem>

  if (!body.userAddress || !body.watchedAddress || !body.type || !body.thresholdEth) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const item: WatchItem = {
    id: randomUUID(),
    userAddress: body.userAddress,
    watchedAddress: body.watchedAddress,
    label: body.label || body.watchedAddress.slice(0, 10),
    type: body.type,
    tokenAddress: body.tokenAddress,
    direction: body.direction || 'any',
    thresholdEth: body.thresholdEth,
    autoPost: body.autoPost ?? false,
    createdAt: new Date().toISOString(),
  }

  return NextResponse.json(addWatchItem(item), { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { id, userAddress } = (await req.json()) as { id: string; userAddress: string }

  if (!id || !userAddress) {
    return NextResponse.json({ error: 'id and userAddress required' }, { status: 400 })
  }

  const ok = removeWatchItem(id, userAddress)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
