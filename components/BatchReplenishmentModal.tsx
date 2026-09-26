'use client'

import { useState, useMemo } from 'react'
import { Product, Warehouse, Transaction } from '@/lib/types'
import {
  PurchaseOrderManifest,
  generatePurchaseOrderManifest,
  exportPurchaseOrderCSV,
  POLineItem,
} from '@/lib/replenishment'
import VelocityBadge from './VelocityBadge'

interface BatchReplenishmentModalProps {
  isOpen: boolean
  onClose: () => void
  products: Product[]
  warehouses: Warehouse[]
  transactions: Transaction[]
  onReplenishSuccess?: (updatedProducts: Product[]) => void
}

export default function BatchReplenishmentModal({
  isOpen,
  onClose,
  products,
  warehouses,
  transactions,
  onReplenishSuccess,
}: BatchReplenishmentModalProps) {
  // Generate initial draft manifest
  const initialManifest = useMemo(() => {
    return generatePurchaseOrderManifest(products, transactions, warehouses)
  }, [products, transactions, warehouses])

  const [poNumber] = useState(initialManifest.poNumber)
  // Per-line order quantities (can be customized by user)
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const item of initialManifest.lineItems) {
      map[item.productId] = item.recommendedQty
    }
    return map
  })

  // Excluded items set
  const [excludedIds, setExcludedIds] = useState<Record<string, boolean>>({})

  // Simulation mode: preview projected post-PO inventory runway
  const [simulationMode, setSimulationMode] = useState(false)
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all')

  // Execution state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [executionResult, setExecutionResult] = useState<{
    success: boolean
    message: string
    executedCount?: number
    totalUnits?: number
  } | null>(null)

  if (!isOpen) return null

  // Active line items
  const activeLineItems = initialManifest.lineItems.filter((i) => !excludedIds[i.productId])

  const filteredLineItems = activeLineItems.filter((i) => {
    if (warehouseFilter !== 'all' && i.warehouseId !== warehouseFilter) return false
    return true
  })

  // Dynamic calculations based on customized order quantities
  const totalUnits = activeLineItems.reduce(
    (sum, item) => sum + (orderQuantities[item.productId] ?? item.recommendedQty),
    0,
  )

  const totalCost = activeLineItems.reduce((sum, item) => {
    const qty = orderQuantities[item.productId] ?? item.recommendedQty
    return sum + qty * item.estimatedUnitCost
  }, 0)

  const criticalCount = activeLineItems.filter((i) => i.urgencyTier === 'CRITICAL').length
  const warningCount = activeLineItems.filter((i) => i.urgencyTier === 'WARNING').length

  function handleQtyChange(productId: string, val: number) {
    setOrderQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(0, Math.floor(val)),
    }))
  }

  function handleQuickAdd(productId: string, delta: number) {
    setOrderQuantities((prev) => {
      const current = prev[productId] ?? 10
      return {
        ...prev,
        [productId]: Math.max(0, current + delta),
      }
    })
  }

  function toggleExclude(productId: string) {
    setExcludedIds((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }))
  }

  function handleExportCSV() {
    const dynamicManifest: PurchaseOrderManifest = {
      ...initialManifest,
      poNumber,
      totalUnitsToOrder: totalUnits,
      totalEstimatedCost: Math.round(totalCost * 100) / 100,
      lineItems: activeLineItems.map((item) => {
        const qty = orderQuantities[item.productId] ?? item.recommendedQty
        return {
          ...item,
          orderQty: qty,
          estimatedTotal: Math.round(qty * item.estimatedUnitCost * 100) / 100,
          projectedStock: item.currentStock + qty,
        }
      }),
    }

    const csvContent = exportPurchaseOrderCSV(dynamicManifest)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${poNumber}-replenishment-manifest.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function handleExecuteReplenishment() {
    if (activeLineItems.length === 0 || totalUnits === 0) return

    setIsSubmitting(true)
    setExecutionResult(null)

    const ordersToSubmit = activeLineItems
      .map((item) => ({
        productId: item.productId,
        quantity: orderQuantities[item.productId] ?? item.recommendedQty,
        warehouseId: item.warehouseId,
      }))
      .filter((o) => o.quantity > 0)

    try {
      const res = await fetch('/api/replenish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poNumber,
          orders: ordersToSubmit,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Replenishment order execution failed')
      }

      setExecutionResult({
        success: true,
        message: `Successfully executed ${poNumber}: Restocked ${data.totalUnitsRestocked} units across ${data.executedCount} SKUs into active inventory ledger.`,
        executedCount: data.executedCount,
        totalUnits: data.totalUnitsRestocked,
      })

      if (data.products && onReplenishSuccess) {
        onReplenishSuccess(data.products)
      }
    } catch (err) {
      setExecutionResult({
        success: false,
        message: err instanceof Error ? err.message : 'Execution failed',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="po-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="po-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="po-modal-header">
          <div className="po-header-title">
            <span className="po-pill-kicker">Automated Procurement Intelligence</span>
            <div className="po-title-row">
              <h2>Purchase Order Manifest</h2>
              <span className="po-number-tag">{poNumber}</span>
              <span className="po-draft-tag">
                {executionResult?.success ? 'EXECUTED' : 'DRAFT MANIFEST'}
              </span>
            </div>
            <p className="po-subtitle">
              Calculated from predictive burn-rate velocity and warehouse threshold deficits.
            </p>
          </div>

          <button
            type="button"
            className="po-close-btn"
            onClick={onClose}
            aria-label="Close manifest modal"
          >
            ✕
          </button>
        </div>

        {/* Success/Error Feedback Banner */}
        {executionResult && (
          <div
            className={`po-feedback-banner ${
              executionResult.success ? 'success' : 'error'
            }`}
          >
            <div className="feedback-content">
              <strong>{executionResult.success ? '✓ Replenishment Applied' : '⚠ Execution Alert'}</strong>
              <p>{executionResult.message}</p>
            </div>
            {executionResult.success && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={onClose}
              >
                Close & View Inventory
              </button>
            )}
          </div>
        )}

        {/* PO Metrics Summary Strip */}
        <div className="po-metrics-strip">
          <div className="po-metric-tile">
            <span className="po-metric-label">Procurement Lines</span>
            <strong className="po-metric-val">{activeLineItems.length} SKUs</strong>
            <small className="po-metric-sub">
              {criticalCount} Critical, {warningCount} Warning
            </small>
          </div>

          <div className="po-metric-tile">
            <span className="po-metric-label">Total Units to Order</span>
            <strong className="po-metric-val">{totalUnits.toLocaleString()} units</strong>
            <small className="po-metric-sub">Automatic batch sizing</small>
          </div>

          <div className="po-metric-tile">
            <span className="po-metric-label">Est. Procurement Cost</span>
            <strong className="po-metric-val highlight-moss">
              ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
            <small className="po-metric-sub">Standard wholesale estimates</small>
          </div>

          <div className="po-metric-tile">
            <span className="po-metric-label">Simulation Controls</span>
            <button
              type="button"
              className={`po-sim-toggle-btn ${simulationMode ? 'active' : ''}`}
              onClick={() => setSimulationMode((prev) => !prev)}
            >
              <span>{simulationMode ? '👁 Showing Post-PO Stock' : '⚡ Preview Post-PO Runway'}</span>
            </button>
            <small className="po-metric-sub">
              {simulationMode ? 'Simulating +14d buffer' : 'Comparing live vs target'}
            </small>
          </div>
        </div>

        {/* Filter and Warehouse Strip */}
        <div className="po-filter-bar">
          <div className="po-filter-left">
            <span className="po-filter-label">Filter Destination:</span>
            <button
              type="button"
              className={`po-filter-chip ${warehouseFilter === 'all' ? 'active' : ''}`}
              onClick={() => setWarehouseFilter('all')}
            >
              All Warehouses ({activeLineItems.length})
            </button>
            {warehouses.map((w) => {
              const count = activeLineItems.filter((i) => i.warehouseId === w.id).length
              return (
                <button
                  key={w.id}
                  type="button"
                  className={`po-filter-chip ${warehouseFilter === w.id ? 'active' : ''}`}
                  onClick={() => setWarehouseFilter(w.id)}
                >
                  {w.name.split(' ')[0]} ({count})
                </button>
              )
            })}
          </div>

          <div className="po-filter-right">
            <button
              type="button"
              className="po-export-csv-btn"
              onClick={handleExportCSV}
              title="Download standard CSV manifest for supplier purchasing"
            >
              📄 Export CSV Manifest
            </button>
          </div>
        </div>

        {/* PO Line Items Table */}
        <div className="po-table-wrapper">
          <table className="po-table">
            <thead>
              <tr>
                <th>Item & Category</th>
                <th>Destination</th>
                <th>Runway / Velocity</th>
                <th>{simulationMode ? 'Projected Stock' : 'Current / Min'}</th>
                <th style={{ width: '190px' }}>Order Quantity</th>
                <th>Est. Unit Cost</th>
                <th>Total Line Cost</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLineItems.map((item) => {
                const qty = orderQuantities[item.productId] ?? item.recommendedQty
                const lineTotal = qty * item.estimatedUnitCost
                const projectedStock = item.currentStock + qty
                const projectedRunway =
                  item.dailyBurnRate > 0
                    ? (projectedStock / item.dailyBurnRate).toFixed(1)
                    : '14+'

                return (
                  <tr key={item.productId} className={item.urgencyTier === 'CRITICAL' ? 'row-critical' : ''}>
                    <td>
                      <div className="po-item-cell">
                        <strong>{item.productName}</strong>
                        <div className="po-item-meta">
                          <span className="sku-tag">{item.productId}</span>
                          <span className="cat-chip">{item.category}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="po-wh-cell">
                        <span>{item.warehouseName}</span>
                      </div>
                    </td>

                    <td>
                      <div className="po-velocity-cell">
                        {simulationMode ? (
                          <span className="sim-runway-badge">
                            ✨ ~{projectedRunway}d runway
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span
                              className={`urgency-pill ${item.urgencyTier.toLowerCase()}`}
                            >
                              {item.daysRemaining !== null
                                ? `${item.daysRemaining}d remaining`
                                : item.currentStock <= item.reorderThreshold
                                ? 'Threshold Deficit'
                                : 'Active'}
                            </span>
                            {item.dailyBurnRate > 0 && (
                              <small style={{ color: 'var(--steel)', fontSize: '10.5px' }}>
                                ⚡ {item.dailyBurnRate} u/day
                              </small>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="po-stock-cell">
                        {simulationMode ? (
                          <div className="sim-stock-display">
                            <span className="sim-stock-new">{projectedStock}</span>
                            <span className="sim-stock-diff">(+{qty})</span>
                          </div>
                        ) : (
                          <div>
                            <strong>{item.currentStock}</strong>
                            <span style={{ color: 'var(--steel)', fontSize: '11px', marginLeft: '4px' }}>
                              / min {item.reorderThreshold}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="po-qty-input-group">
                        <input
                          type="number"
                          min={0}
                          className="po-qty-input"
                          value={qty}
                          onChange={(e) =>
                            handleQtyChange(item.productId, Number(e.target.value))
                          }
                          disabled={isSubmitting || executionResult?.success}
                        />
                        <div className="po-quick-adj">
                          <button
                            type="button"
                            onClick={() => handleQuickAdd(item.productId, 10)}
                            title="Add 10 units"
                          >
                            +10
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAdd(item.productId, 25)}
                            title="Add 25 units"
                          >
                            +25
                          </button>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="po-cost-cell">
                        ${item.estimatedUnitCost.toFixed(2)}
                      </span>
                    </td>

                    <td>
                      <strong className="po-cost-cell">
                        ${lineTotal.toFixed(2)}
                      </strong>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="po-remove-btn"
                        onClick={() => toggleExclude(item.productId)}
                        title="Exclude from this PO manifest"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}

              {filteredLineItems.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--steel)' }}>
                    No replenishment line items match current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Footer Controls */}
        <div className="po-modal-footer">
          <div className="po-footer-left">
            <span style={{ fontSize: '12px', color: 'var(--steel)' }}>
              🔒 Dual-linked atomic ledger posting enabled
            </span>
          </div>

          <div className="po-footer-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary po-execute-btn"
              onClick={handleExecuteReplenishment}
              disabled={isSubmitting || activeLineItems.length === 0 || executionResult?.success}
            >
              {isSubmitting ? (
                <>⏳ Executing Batch Restock...</>
              ) : executionResult?.success ? (
                <>✓ Replenishment Completed</>
              ) : (
                <>⚡ One-Click Batch Replenish ({totalUnits} units)</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
