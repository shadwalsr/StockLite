import { Product, Transaction } from './types'

export type VelocityTier = 'CRITICAL' | 'WARNING' | 'STABLE'

export interface ItemVelocity {
  productId: string
  warehouseId: string
  dailyBurnRate: number
  daysRemaining: number | null // null if velocity is 0
  tier: VelocityTier
  label: string
  totalOutboundQty: number
  outboundEventCount: number
  burnRateBasis: 'time-span' | 'event-cycle' | 'zero-burn'
}

/**
 * Calculates predictive depletion velocity and stockout runway for all items.
 * Consumes current products and transaction ledger history.
 */
export function calculateRunoutVelocity(
  items: any[],
  transactions: any[],
): Record<string, ItemVelocity> {
  const result: Record<string, ItemVelocity> = {}

  // 1. Filter transactions for outbound events ('OUT' or 'TRANSFER_OUT')
  const outboundTx = (transactions || []).filter(
    (t) => t && (t.type === 'OUT' || t.type === 'TRANSFER_OUT') && Number(t.quantity) > 0,
  )

  // 2. Group outbound movements by product ID (and product+warehouse pair)
  interface ProductOutboundStats {
    totalQty: number
    eventCount: number
    timestamps: number[]
  }

  const statsByProductId: Record<string, ProductOutboundStats> = {}
  const statsByProductWh: Record<string, ProductOutboundStats> = {}

  for (const tx of outboundTx) {
    const qty = Number(tx.quantity) || 0
    const ts = tx.timestamp ? new Date(tx.timestamp).getTime() : Date.now()
    const pId = tx.productId
    const whId = tx.warehouseId

    // By Product ID
    if (!statsByProductId[pId]) {
      statsByProductId[pId] = { totalQty: 0, eventCount: 0, timestamps: [] }
    }
    statsByProductId[pId].totalQty += qty
    statsByProductId[pId].eventCount += 1
    if (!Number.isNaN(ts)) {
      statsByProductId[pId].timestamps.push(ts)
    }

    // By Product + Warehouse ID
    if (whId) {
      const pairKey = `${pId}:${whId}`
      if (!statsByProductWh[pairKey]) {
        statsByProductWh[pairKey] = { totalQty: 0, eventCount: 0, timestamps: [] }
      }
      statsByProductWh[pairKey].totalQty += qty
      statsByProductWh[pairKey].eventCount += 1
      if (!Number.isNaN(ts)) {
        statsByProductWh[pairKey].timestamps.push(ts)
      }
    }
  }

  // 3. Compute velocity for each item
  for (const item of items || []) {
    const pId = item.id || item.productId
    const whId = item.warehouseId
    const currentStock = Math.max(0, Number(item.currentStock) || 0)

    // Lookup matching outbound stats (prefer warehouse-specific if available, fallback to product-level)
    const pairKey = whId ? `${pId}:${whId}` : null
    const stats =
      (pairKey && statsByProductWh[pairKey]) ||
      statsByProductId[pId] || { totalQty: 0, eventCount: 0, timestamps: [] }

    let dailyBurnRate = 0
    let burnRateBasis: 'time-span' | 'event-cycle' | 'zero-burn' = 'zero-burn'

    if (stats.totalQty > 0 && stats.eventCount > 0) {
      // Calculate time span if multiple timestamps exist
      let daysSpan = 0
      if (stats.timestamps.length >= 2) {
        const minTime = Math.min(...stats.timestamps)
        const maxTime = Math.max(...stats.timestamps)
        daysSpan = (maxTime - minTime) / (1000 * 60 * 60 * 24)
      }

      if (daysSpan >= 1.0) {
        // Daily burn rate over time delta
        dailyBurnRate = stats.totalQty / daysSpan
        burnRateBasis = 'time-span'
      } else {
        // Operational velocity per event cycle if timestamps are clustered/simulated
        dailyBurnRate = stats.totalQty / Math.max(1, stats.eventCount)
        burnRateBasis = 'event-cycle'
      }
    }

    // Clean daily burn rate to 1 decimal place
    dailyBurnRate = Math.round(dailyBurnRate * 10) / 10

    // Compute Days Remaining runway
    let daysRemaining: number | null = null
    let tier: VelocityTier = 'STABLE'
    let label = 'No outbound burn'

    if (dailyBurnRate > 0) {
      daysRemaining = Math.round((currentStock / dailyBurnRate) * 10) / 10

      if (daysRemaining < 3.0) {
        tier = 'CRITICAL'
        label = `< 3.0d runway (${daysRemaining}d)`
      } else if (daysRemaining <= 7.0) {
        tier = 'WARNING'
        label = `Warning: ${daysRemaining}d runway`
      } else {
        tier = 'STABLE'
        label = `Stable (${daysRemaining}d runway)`
      }
    } else {
      // Zero burn rate: if item is already below or at reorder threshold, highlight risk
      if (item.reorderThreshold && currentStock <= item.reorderThreshold) {
        tier = currentStock === 0 ? 'CRITICAL' : 'WARNING'
        label = currentStock === 0 ? 'Stockout (0 units)' : 'At/below threshold'
      } else {
        tier = 'STABLE'
        label = 'Stable (Inactive burn)'
      }
    }

    const velocityRecord: ItemVelocity = {
      productId: pId,
      warehouseId: whId || '',
      dailyBurnRate,
      daysRemaining,
      tier,
      label,
      totalOutboundQty: stats.totalQty,
      outboundEventCount: stats.eventCount,
      burnRateBasis,
    }

    // Populate under multiple keys for resilient indexing
    result[pId] = velocityRecord
    if (pairKey) {
      result[pairKey] = velocityRecord
    }
  }

  return result
}

/**
 * Returns industrial UI theme color tokens for a given velocity tier.
 */
export function getVelocityTierColor(tier: VelocityTier): {
  bg: string
  color: string
  border: string
  dot: string
} {
  switch (tier) {
    case 'CRITICAL':
      return {
        bg: 'color-mix(in srgb, var(--rust) 14%, var(--white))',
        color: 'var(--rust)',
        border: 'color-mix(in srgb, var(--rust) 40%, transparent)',
        dot: 'var(--rust)',
      }
    case 'WARNING':
      return {
        bg: 'color-mix(in srgb, var(--brass) 14%, var(--white))',
        color: 'var(--brass)',
        border: 'color-mix(in srgb, var(--brass) 40%, transparent)',
        dot: 'var(--brass)',
      }
    case 'STABLE':
    default:
      return {
        bg: 'color-mix(in srgb, var(--moss) 12%, var(--white))',
        color: 'var(--moss)',
        border: 'color-mix(in srgb, var(--moss) 35%, transparent)',
        dot: 'var(--moss)',
      }
  }
}
