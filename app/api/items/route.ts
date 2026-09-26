import { NextResponse } from 'next/server'
import { applyStockMovement, applyTransfer, products } from '@/lib/seed-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ products })
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action

  try {
    if (action === 'stock') {
      const { productId, quantity, direction } = body as {
        productId: string
        quantity: number
        direction: 'IN' | 'OUT'
      }
      if (!productId || typeof productId !== 'string') {
        return NextResponse.json(
          { error: 'Valid productId is required' },
          { status: 400 },
        )
      }
      if (direction !== 'IN' && direction !== 'OUT') {
        return NextResponse.json(
          { error: 'direction must be IN or OUT' },
          { status: 400 },
        )
      }
      const numQty = Number(quantity)
      if (!Number.isFinite(numQty) || Number.isNaN(numQty) || numQty <= 0) {
        return NextResponse.json(
          { error: 'Quantity must be a positive number greater than 0' },
          { status: 400 },
        )
      }
      const product = applyStockMovement(productId, numQty, direction)
      return NextResponse.json({ product, products })
    }

    if (action === 'transfer') {
      const { productId, destWarehouseId, quantity } = body as {
        productId: string
        destWarehouseId: string
        quantity: number
      }
      if (!productId || typeof productId !== 'string') {
        return NextResponse.json(
          { error: 'Valid productId is required' },
          { status: 400 },
        )
      }
      if (!destWarehouseId || typeof destWarehouseId !== 'string') {
        return NextResponse.json(
          { error: 'Valid destWarehouseId is required' },
          { status: 400 },
        )
      }
      const numQty = Number(quantity)
      if (!Number.isFinite(numQty) || Number.isNaN(numQty) || numQty <= 0) {
        return NextResponse.json(
          { error: 'Quantity must be a positive number greater than 0' },
          { status: 400 },
        )
      }
      const { source, destination } = applyTransfer(
        productId,
        destWarehouseId,
        numQty,
      )
      return NextResponse.json({ source, destination, products })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
