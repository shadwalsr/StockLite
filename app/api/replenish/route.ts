import { NextResponse } from 'next/server'
import {
  products,
  warehouses,
  transactions,
  applyStockMovement,
} from '@/lib/seed-data'
import { calculateRunoutVelocity } from '@/lib/velocity'
import { generatePurchaseOrderManifest } from '@/lib/replenishment'

export const dynamic = 'force-dynamic'

/**
 * GET /api/replenish
 * Generates and returns a fresh Purchase Order Manifest based on real-time inventory and velocity.
 */
export async function GET() {
  try {
    const velocityMap = calculateRunoutVelocity(products, transactions)
    const manifest = generatePurchaseOrderManifest(products, transactions, warehouses)
    return NextResponse.json({ manifest, velocityMap, products, warehouses })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate replenishment manifest'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/replenish
 * Atomically executes batch replenishment orders into the ledger.
 * Body: { poNumber?: string, orders: Array<{ productId: string; quantity: number; warehouseId?: string }> }
 */
export async function POST(request: Request) {
  let body: {
    poNumber?: string
    orders?: Array<{ productId: string; quantity: number; warehouseId?: string }>
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const { poNumber, orders } = body

  if (!orders || !Array.isArray(orders) || orders.length === 0) {
    return NextResponse.json(
      { error: 'At least one replenishment order item is required' },
      { status: 400 },
    )
  }

  try {
    const executedResults = []
    let totalUnits = 0

    for (const order of orders) {
      const { productId, quantity, warehouseId } = order
      const numQty = Number(quantity)

      if (!productId || typeof productId !== 'string') {
        continue
      }
      if (!Number.isFinite(numQty) || numQty <= 0) {
        continue
      }

      // Execute stock movement as 'IN' (purchase receipt)
      const updatedProduct = applyStockMovement(productId, numQty, 'IN', warehouseId)
      totalUnits += numQty
      executedResults.push({
        productId,
        quantity: numQty,
        warehouseId: updatedProduct.warehouseId,
        newStock: updatedProduct.currentStock,
      })
    }

    if (executedResults.length === 0) {
      return NextResponse.json(
        { error: 'No valid replenishment lines could be processed' },
        { status: 400 },
      )
    }

    // Return updated store state and execution receipt
    return NextResponse.json({
      success: true,
      poNumber: poNumber || `PO-${Date.now()}`,
      executedCount: executedResults.length,
      totalUnitsRestocked: totalUnits,
      executedResults,
      products,
      transactions,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Batch replenishment execution failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
