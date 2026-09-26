import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const staffId = typeof body?.staffId === 'string' ? body.staffId : ''
  const pin = typeof body?.pin === 'string' ? body.pin : ''
  const user = authenticateUser(staffId, pin)

  if (!user) {
    return NextResponse.json(
      { error: 'Invalid staff ID or PIN.' },
      { status: 401 },
    )
  }

  return NextResponse.json({ user })
}