'use client'

import { useState, useMemo, useEffect } from 'react'
import { Product, Warehouse, Transaction } from '@/lib/types'
import { calculateRunoutVelocity, ItemVelocity, VelocityTier } from '@/lib/velocity'
import VelocityBadge from './VelocityBadge'
import BatchReplenishmentModal from './BatchReplenishmentModal'

interface IntelligenceSuiteProps {
  initialProducts: Product[]
  warehouses: Warehouse[]
  initialTransactions?: Transaction[]
  onStockUpdated?: (newProducts: Product[]) => void
}

export default function IntelligenceSuite({
  initialProducts,
  warehouses,
  initialTransactions = [],
  onStockUpdated,
}: IntelligenceSuiteProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [isPOModalOpen, setIsPOModalOpen] = useState(false)
  const [tierFilter, setTierFilter] = useState<'ALL' | VelocityTier>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [expanded, setExpanded] = useState(false)

  // Sync with prop updates
  useEffect(() => {
    setProducts(initialProducts)
  }, [initialProducts])

  // Fetch latest transactions if not provided
  useEffect(() => {
    if (initialTransactions.length === 0) {
      fetch('/api/transactions')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.transactions) {
            setTransactions(data.transactions)
          }
        })
        .catch(() => {})
    }
  }, [initialTransactions])

  // Compute velocity map
  const velocityMap = useMemo(() => {
    return calculateRunoutVelocity(products, transactions)
  }, [products, transactions])

  // Aggregate metrics
  const metrics = useMemo(() => {
    let criticalCount = 0
    let warningCount = 0
    let stableCount = 0
    let totalBurn = 0

    for (const p of products) {
      const vel = velocityMap[p.id] || velocityMap[`${p.id}:${p.warehouseId}`]
      if (vel) {
        if (vel.tier === 'CRITICAL') criticalCount++
        else if (vel.tier === 'WARNING') warningCount++
        else stableCount++
        totalBurn += vel.dailyBurnRate
      } else {
        stableCount++
      }
    }

    const avgBurn = products.length > 0 ? (totalBurn / products.length).toFixed(1) : '0'

    return {
      criticalCount,
      warningCount,
      stableCount,
      totalBurn: Math.round(totalBurn * 10) / 10,
      avgBurn,
      urgentCount: criticalCount + warningCount,
    }
  }, [products, velocityMap])

  // Filtered product list for velocity drawer/view
  const filteredItems = useMemo(() => {
    return products
      .filter((p) => {
        const vel = velocityMap[p.id] || velocityMap[`${p.id}:${p.warehouseId}`]
        const tier = vel?.tier || 'STABLE'

        if (tierFilter !== 'ALL' && tier !== tierFilter) return false

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          const matchesName = p.name.toLowerCase().includes(q)
          const matchesId = p.id.toLowerCase().includes(q)
          const matchesCat = p.category.toLowerCase().includes(q)
          if (!matchesName && !matchesId && !matchesCat) return false
        }

        return true
      })
      .sort((a, b) => {
        const velA = velocityMap[a.id] || velocityMap[`${a.id}:${a.warehouseId}`]
        const velB = velocityMap[b.id] || velocityMap[`${b.id}:${b.warehouseId}`]
        const runwayA = velA?.daysRemaining ?? 999
        const runwayB = velB?.daysRemaining ?? 999
        return runwayA - runwayB
      })
  }, [products, velocityMap, tierFilter, searchQuery])

  function handleReplenishSuccess(updatedProducts: Product[]) {
    setProducts(updatedProducts)
    if (onStockUpdated) onStockUpdated(updatedProducts)

    // Re-fetch transactions to reflect the batch restock
    fetch('/api/transactions')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.transactions) {
          setTransactions(data.transactions)
        }
      })
      .catch(() => {})
  }

  return (
    <>
      <div className="intelligence-suite-container">
        {/* Intelligence Suite Header Banner */}
        <div className="intelligence-banner">
          <div className="intelligence-kicker-row">
            <span className="intel-pill">⚡ Advanced Intelligence Suite</span>
            <span className="intel-tag">Real-Time Forecasting</span>
          </div>

          <div className="intelligence-hero-row">
            <div className="intelligence-copy">
              <h2>Predictive Runout Velocity & Auto-PO Generator</h2>
              <p>
                Continuously analyzes outbound transaction velocity to forecast stockout runways (<span style={{ color: 'var(--rust)', fontWeight: 600 }}>&lt; 3.0d critical</span>) and generates 1-click batch procurement orders.
              </p>
            </div>

            <div className="intelligence-actions">
              <button
                type="button"
                className="btn btn-primary intel-po-btn"
                onClick={() => setIsPOModalOpen(true)}
              >
                <span>🔒 Generate Replenishment PO</span>
                {metrics.urgentCount > 0 && (
                  <span className="intel-badge-count">{metrics.urgentCount}</span>
                )}
              </button>

              <button
                type="button"
                className="btn btn-secondary intel-toggle-btn"
                onClick={() => setExpanded((prev) => !prev)}
              >
                {expanded ? '▲ Collapse Velocity' : '▼ Inspect Velocity'}
              </button>
            </div>
          </div>

          {/* Quick Velocity KPI Strip */}
          <div className="intelligence-kpi-grid">
            <div
              className={`intel-kpi-card ${metrics.criticalCount > 0 ? 'alert-critical' : ''}`}
              onClick={() => {
                setTierFilter('CRITICAL')
                setExpanded(true)
              }}
              role="button"
              tabIndex={0}
              title="Click to filter critical runway items"
            >
              <div className="kpi-top">
                <span className="kpi-indicator dot-critical" />
                <span className="kpi-label">Critical Runout (&lt; 3.0d)</span>
              </div>
              <strong className="kpi-number text-rust">{metrics.criticalCount}</strong>
              <small className="kpi-sub">Immediate stockout hazard</small>
            </div>

            <div
              className={`intel-kpi-card ${metrics.warningCount > 0 ? 'alert-warning' : ''}`}
              onClick={() => {
                setTierFilter('WARNING')
                setExpanded(true)
              }}
              role="button"
              tabIndex={0}
              title="Click to filter warning runway items"
            >
              <div className="kpi-top">
                <span className="kpi-indicator dot-warning" />
                <span className="kpi-label">Shift Warning (3 - 7d)</span>
              </div>
              <strong className="kpi-number text-brass">{metrics.warningCount}</strong>
              <small className="kpi-sub">Reorder required soon</small>
            </div>

            <div
              className="intel-kpi-card"
              onClick={() => {
                setTierFilter('STABLE')
                setExpanded(true)
              }}
              role="button"
              tabIndex={0}
            >
              <div className="kpi-top">
                <span className="kpi-indicator dot-stable" />
                <span className="kpi-label">Adequate Runway (&gt; 7d)</span>
              </div>
              <strong className="kpi-number text-moss">{metrics.stableCount}</strong>
              <small className="kpi-sub">Sufficient inventory</small>
            </div>

            <div className="intel-kpi-card">
              <div className="kpi-top">
                <span className="kpi-indicator dot-neutral" />
                <span className="kpi-label">Total Outbound Burn</span>
              </div>
              <strong className="kpi-number text-ink">{metrics.totalBurn} u/d</strong>
              <small className="kpi-sub">Avg {metrics.avgBurn} units/item/day</small>
            </div>
          </div>
        </div>

        {/* Expandable Velocity Engine Drawer */}
        {expanded && (
          <div className="velocity-inspector-panel">
            <div className="inspector-controls">
              <div className="inspector-filters">
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--steel)' }}>
                  Filter Urgency:
                </span>
                <button
                  type="button"
                  className={`inspector-chip ${tierFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setTierFilter('ALL')}
                >
                  All ({products.length})
                </button>
                <button
                  type="button"
                  className={`inspector-chip chip-critical ${tierFilter === 'CRITICAL' ? 'active' : ''}`}
                  onClick={() => setTierFilter('CRITICAL')}
                >
                  Critical ({metrics.criticalCount})
                </button>
                <button
                  type="button"
                  className={`inspector-chip chip-warning ${tierFilter === 'WARNING' ? 'active' : ''}`}
                  onClick={() => setTierFilter('WARNING')}
                >
                  Warning ({metrics.warningCount})
                </button>
                <button
                  type="button"
                  className={`inspector-chip chip-stable ${tierFilter === 'STABLE' ? 'active' : ''}`}
                  onClick={() => setTierFilter('STABLE')}
                >
                  Stable ({metrics.stableCount})
                </button>
              </div>

              <div className="inspector-search">
                <input
                  type="text"
                  placeholder="Search SKU or Category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="inspector-search-input"
                />
              </div>
            </div>

            {/* Velocity Forecast Table */}
            <div className="velocity-table-wrapper">
              <table className="velocity-table">
                <thead>
                  <tr>
                    <th>Product & SKU</th>
                    <th>Warehouse</th>
                    <th>Stock / Threshold</th>
                    <th>Daily Burn Velocity</th>
                    <th>Projected Depletion Runway</th>
                    <th>Urgency Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((p) => {
                    const vel = velocityMap[p.id] || velocityMap[`${p.id}:${p.warehouseId}`]
                    const whName = warehouses.find((w) => w.id === p.warehouseId)?.name || p.warehouseId
                    const burn = vel?.dailyBurnRate || 0
                    const days = vel?.daysRemaining

                    return (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                            <span className="sku-tag">{p.id}</span>
                            <span className="cat-chip">{p.category}</span>
                          </div>
                        </td>

                        <td>
                          <span style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>
                            {whName}
                          </span>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ fontSize: '15px' }}>{p.currentStock}</strong>
                            <small style={{ color: 'var(--steel)', fontSize: '11px' }}>
                              / min {p.reorderThreshold}
                            </small>
                          </div>
                        </td>

                        <td>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--ink)' }}>
                            {burn > 0 ? `⚡ ${burn} units/day` : '0 u/day'}
                          </span>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong
                              style={{
                                fontSize: '14px',
                                color:
                                  vel?.tier === 'CRITICAL'
                                    ? 'var(--rust)'
                                    : vel?.tier === 'WARNING'
                                    ? 'var(--brass)'
                                    : 'var(--moss)',
                              }}
                            >
                              {days !== null ? `${days} days` : 'No burn'}
                            </strong>
                            {days !== null && (
                              <div
                                style={{
                                  width: '45px',
                                  height: '4px',
                                  background: 'var(--steel-light)',
                                  borderRadius: '99px',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${Math.min(100, Math.max(5, (days / 14) * 100))}%`,
                                    background:
                                      vel?.tier === 'CRITICAL'
                                        ? 'var(--rust)'
                                        : vel?.tier === 'WARNING'
                                        ? 'var(--brass)'
                                        : 'var(--moss)',
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </td>

                        <td>
                          <VelocityBadge velocity={vel} compact />
                        </td>
                      </tr>
                    )
                  })}

                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '28px', color: 'var(--steel)' }}>
                        No items match the selected velocity urgency filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Batch Replenishment PO Manifest Modal */}
      <BatchReplenishmentModal
        isOpen={isPOModalOpen}
        onClose={() => setIsPOModalOpen(false)}
        products={products}
        warehouses={warehouses}
        transactions={transactions}
        onReplenishSuccess={handleReplenishSuccess}
      />
    </>
  )
}
