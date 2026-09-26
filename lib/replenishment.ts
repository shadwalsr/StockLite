import { Product, Warehouse, Transaction } from './types'
import { calculateRunoutVelocity, ItemVelocity, VelocityTier } from './velocity'
import { isLowStock } from './inventory-store'

export interface POLineItem {
  productId: string
  productName: string
  category: string
  warehouseId: string
  warehouseName: string
  currentStock: number
  reorderThreshold: number
  dailyBurnRate: number
  daysRemaining: number | null
  urgencyTier: VelocityTier | 'THRESHOLD'
  recommendedQty: number
  orderQty: number
  estimatedUnitCost: number
  estimatedTotal: number
  projectedStock: number
  projectedDaysRemaining: number | null
}

export interface PurchaseOrderManifest {
  poNumber: string
  generatedAt: string
  status: 'DRAFT' | 'EXECUTED'
  warehouseSummary: Array<{
    warehouseId: string
    warehouseName: string
    itemCount: number
    totalUnits: number
    subtotalCost: number
  }>
  lineItems: POLineItem[]
  totalItems: number
  totalUnitsToOrder: number
  totalEstimatedCost: number
  criticalCount: number
  warningCount: number
}

// Category-based standard wholesale cost estimates ($ USD)
const CATEGORY_UNIT_COSTS: Record<string, number> = {
  Packaging: 6.5,
  Equipment: 280.0,
  Safety: 16.0,
  Electronics: 85.0,
  Hardware: 22.0,
  'Material Handling': 165.0,
}

export function getEstimatedUnitCost(category: string): number {
  return CATEGORY_UNIT_COSTS[category] || 25.0
}

/**
 * Calculates recommended procurement order quantity for an item based on
 * current stock, reorder threshold, and daily burn rate velocity.
 */
export function calculateRecommendedOrderQty(
  product: Product,
  velocity?: ItemVelocity,
): number {
  const current = Math.max(0, product.currentStock)
  const threshold = product.reorderThreshold

  // Target safety buffer: 14 days of operational burn rate OR 2x threshold
  const burnRate = velocity?.dailyBurnRate || 0
  const runwayTarget = burnRate > 0 ? Math.ceil(burnRate * 14) : 0
  const thresholdTarget = threshold * 2

  const targetStock = Math.max(thresholdTarget, runwayTarget)
  const rawDeficit = Math.max(0, targetStock - current)

  // Enforce realistic minimum batch size (multiples of 5 or 10)
  if (rawDeficit <= 0) return 0
  const rounded = Math.ceil(rawDeficit / 10) * 10
  return Math.max(10, rounded)
}

/**
 * Generates a complete Purchase Order Manifest from current inventory and velocity forecast.
 */
export function generatePurchaseOrderManifest(
  products: Product[],
  transactions: Transaction[],
  warehouses: Warehouse[],
): PurchaseOrderManifest {
  const velocityMap = calculateRunoutVelocity(products, transactions)
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  const poNumber = `PO-${dateStr}-${randomSuffix}`

  const warehouseMap = new Map(warehouses.map((w) => [w.id, w.name]))

  const lineItems: POLineItem[] = []

  for (const product of products) {
    const vel = velocityMap[product.id] || velocityMap[`${product.id}:${product.warehouseId}`]
    const isBelowThreshold = isLowStock(product.currentStock, product.reorderThreshold)
    const isUrgentVelocity = vel && (vel.tier === 'CRITICAL' || vel.tier === 'WARNING')

    // Include item in PO if it's below threshold OR has critical/warning depletion runway
    if (isBelowThreshold || isUrgentVelocity) {
      const recommendedQty = calculateRecommendedOrderQty(product, vel)
      if (recommendedQty > 0) {
        const unitCost = getEstimatedUnitCost(product.category)
        const estimatedTotal = Math.round(recommendedQty * unitCost * 100) / 100
        const projectedStock = product.currentStock + recommendedQty
        const burnRate = vel?.dailyBurnRate || 0
        const projectedDaysRemaining =
          burnRate > 0 ? Math.round((projectedStock / burnRate) * 10) / 10 : null

        let urgencyTier: VelocityTier | 'THRESHOLD' = vel ? vel.tier : 'THRESHOLD'
        if (product.currentStock === 0) urgencyTier = 'CRITICAL'

        lineItems.push({
          productId: product.id,
          productName: product.name,
          category: product.category,
          warehouseId: product.warehouseId,
          warehouseName: warehouseMap.get(product.warehouseId) || product.warehouseId,
          currentStock: product.currentStock,
          reorderThreshold: product.reorderThreshold,
          dailyBurnRate: burnRate,
          daysRemaining: vel?.daysRemaining ?? null,
          urgencyTier,
          recommendedQty,
          orderQty: recommendedQty,
          estimatedUnitCost: unitCost,
          estimatedTotal,
          projectedStock,
          projectedDaysRemaining,
        })
      }
    }
  }

  // Sort line items: CRITICAL first, then WARNING, then by highest deficit
  const urgencyWeight = { CRITICAL: 0, WARNING: 1, THRESHOLD: 2, STABLE: 3 }
  lineItems.sort((a, b) => {
    const weightDiff = (urgencyWeight[a.urgencyTier] ?? 3) - (urgencyWeight[b.urgencyTier] ?? 3)
    if (weightDiff !== 0) return weightDiff
    return (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999)
  })

  // Warehouse breakdown
  const warehouseSummaries: Record<string, { itemCount: number; totalUnits: number; subtotalCost: number }> = {}
  for (const item of lineItems) {
    if (!warehouseSummaries[item.warehouseId]) {
      warehouseSummaries[item.warehouseId] = { itemCount: 0, totalUnits: 0, subtotalCost: 0 }
    }
    warehouseSummaries[item.warehouseId].itemCount += 1
    warehouseSummaries[item.warehouseId].totalUnits += item.orderQty
    warehouseSummaries[item.warehouseId].subtotalCost += item.estimatedTotal
  }

  const warehouseSummaryList = Object.entries(warehouseSummaries).map(([wId, stats]) => ({
    warehouseId: wId,
    warehouseName: warehouseMap.get(wId) || wId,
    itemCount: stats.itemCount,
    totalUnits: stats.totalUnits,
    subtotalCost: Math.round(stats.subtotalCost * 100) / 100,
  }))

  const totalUnitsToOrder = lineItems.reduce((acc, item) => acc + item.orderQty, 0)
  const totalEstimatedCost = Math.round(
    lineItems.reduce((acc, item) => acc + item.estimatedTotal, 0) * 100,
  ) / 100
  const criticalCount = lineItems.filter((i) => i.urgencyTier === 'CRITICAL').length
  const warningCount = lineItems.filter((i) => i.urgencyTier === 'WARNING').length

  return {
    poNumber,
    generatedAt: now.toISOString(),
    status: 'DRAFT',
    warehouseSummary: warehouseSummaryList,
    lineItems,
    totalItems: lineItems.length,
    totalUnitsToOrder,
    totalEstimatedCost,
    criticalCount,
    warningCount,
  }
}

/**
 * Formats a Purchase Order Manifest as a standard CSV file for warehouse procurement.
 */
export function exportPurchaseOrderCSV(po: PurchaseOrderManifest): string {
  const headers = [
    'PO Number',
    'SKU ID',
    'Product Name',
    'Category',
    'Destination Warehouse',
    'Current Stock',
    'Reorder Threshold',
    'Burn Rate (units/day)',
    'Days Remaining',
    'Urgency',
    'Order Quantity',
    'Est. Unit Cost ($)',
    'Line Total ($)',
    'Projected Post-PO Stock',
  ]

  const rows = po.lineItems.map((item) => [
    `"${po.poNumber}"`,
    `"${item.productId}"`,
    `"${item.productName.replace(/"/g, '""')}"`,
    `"${item.category}"`,
    `"${item.warehouseName.replace(/"/g, '""')}"`,
    item.currentStock,
    item.reorderThreshold,
    item.dailyBurnRate,
    item.daysRemaining !== null ? item.daysRemaining : 'N/A',
    item.urgencyTier,
    item.orderQty,
    item.estimatedUnitCost.toFixed(2),
    item.estimatedTotal.toFixed(2),
    item.projectedStock,
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}
