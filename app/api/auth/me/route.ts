import { NextRequest, NextResponse } from 'next/server'
import { getSessionAddress } from '@/lib/session'

// Lets the client restore an existing session on load (e.g. after refresh)
// without prompting for another signature.
export async function GET(req: NextRequest) {
  const address = getSessionAddress(req)
  if (!address) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  return NextResponse.json({ address })
}
