'use client'

import { useState, useMemo, useEffect } from 'react'
import { Product, Warehouse, getStockStatus, getStockStatusLabel } from '@/lib/types'
import { warehouses as defaultWarehouses } from '@/lib/seed-data'
import { isLowStock } from '@/lib/inventory-store'
import StatusBadge from './StatusBadge'

interface StockFormProps {
  products: Product[]
  warehouses?: Warehouse[]
}

interface ActionFeedback {
  type: 'success' | 'error'
  message: string
}

export default function StockForm({
  products: initialProducts,
  warehouses: initialWarehouses = defaultWarehouses,
}: StockFormProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses)

  // Filters and search
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('all')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'stock-asc' | 'stock-desc'>('name')

  // Per-item UI state
  // mode: 'BUY' (Stock In) or 'OUT' (Stock Out)
  const [itemModes, setItemModes] = useState<Record<string, 'BUY' | 'OUT'>>({})
  const [targetWarehouses, setTargetWarehouses] = useState<Record<string, string>>({})
  const [quantities, setQuantities] = useState<Record<string, number | ''>>({})
  const [submittingIds, setSubmittingIds] = useState<Record<string, boolean>>({})
  const [feedbacks, setFeedbacks] = useState<Record<string, ActionFeedback>>({})

  // Fetch fresh catalog data from API on mount
  useEffect(() => {
    fetch('/api/items')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.products) setProducts(data.products)
        if (data?.warehouses) setWarehouses(data.warehouses)
      })
      .catch(() => {})
  }, [])

  const categories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.category))).sort()
  }, [products])

  const warehouseName = (id: string) => {
    return warehouses.find((w) => w.id === id)?.name ?? id
  }

  // Summary counts
  const summaryStats = useMemo(() => {
    const totalItems = products.length
    const lowStockCount = products.filter((p) =>
      isLowStock(p.currentStock, p.reorderThreshold),
    ).length
    const totalUnits = products.reduce((acc, p) => acc + p.currentStock, 0)
    return { totalItems, lowStockCount, totalUnits }
  }, [products])

  // Filtered & sorted product list
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          const matchesName = p.name.toLowerCase().includes(q)
          const matchesId = p.id.toLowerCase().includes(q)
          const matchesCat = p.category.toLowerCase().includes(q)
          if (!matchesName && !matchesId && !matchesCat) return false
        }
        if (selectedWarehouseFilter !== 'all' && p.warehouseId !== selectedWarehouseFilter) {
          return false
        }
        if (selectedCategoryFilter !== 'all' && p.category !== selectedCategoryFilter) {
          return false
        }
        if (lowStockOnly && !isLowStock(p.currentStock, p.reorderThreshold)) {
          return false
        }
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name)
        if (sortBy === 'stock-asc') return a.currentStock - b.currentStock
        if (sortBy === 'stock-desc') return b.currentStock - a.currentStock
        return 0
      })
  }, [products, searchQuery, selectedWarehouseFilter, selectedCategoryFilter, lowStockOnly, sortBy])

  // Helper for suggested order quantity
  function getSuggestedQuantity(product: Product): number {
    const deficit = Math.max(0, product.reorderThreshold - product.currentStock)
    if (deficit > 0) {
      return Math.max(10, deficit + Math.ceil(product.reorderThreshold * 0.25))
    }
    return 25
  }

  // Set quantity for a given product
  function handleQuantityChange(productId: string, val: number | '') {
    setQuantities((prev) => ({
      ...prev,
      [productId]: val === '' ? '' : Math.max(1, Math.floor(val)),
    }))
  }

  // Change target warehouse to buy into
  function handleTargetWarehouseChange(productId: string, whId: string) {
    setTargetWarehouses((prev) => ({
      ...prev,
      [productId]: whId,
    }))
  }

  // Switch between BUY and OUT
  function handleModeChange(productId: string, mode: 'BUY' | 'OUT') {
    setItemModes((prev) => ({
      ...prev,
      [productId]: mode,
    }))
    // Clear feedback when mode changes
    setFeedbacks((prev) => {
      const next = { ...prev }
      delete next[productId]
      return next
    })
  }

  // Logic to execute BUY (Stock In into selected warehouse)
  async function executeBuy(product: Product) {
    const targetWhId = targetWarehouses[product.id] || product.warehouseId
    const qtyValue = quantities[product.id]
    const chosenQty = typeof qtyValue === 'number' && qtyValue > 0 ? qtyValue : getSuggestedQuantity(product)

    if (!chosenQty || !Number.isFinite(chosenQty) || chosenQty <= 0) {
      setFeedbacks((prev) => ({
        ...prev,
        [product.id]: {
          type: 'error',
          message: 'Please enter a valid purchase quantity greater than 0.',
        },
      }))
      return
    }

    setSubmittingIds((prev) => ({ ...prev, [product.id]: true }))
    setFeedbacks((prev) => {
      const next = { ...prev }
      delete next[product.id]
      return next
    })

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'buy',
          productId: product.id,
          warehouseId: targetWhId,
          quantity: chosenQty,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setFeedbacks((prev) => ({
          ...prev,
          [product.id]: {
            type: 'error',
            message: data.error ?? 'Purchase request failed.',
          },
        }))
        return
      }

      if (data.products) {
        setProducts(data.products)
      }

      const whTargetName = warehouseName(targetWhId)
      setFeedbacks((prev) => ({
        ...prev,
        [product.id]: {
          type: 'success',
          message: `✓ Purchased & stocked in ${chosenQty} units to ${whTargetName}! Current stock: ${data.product.currentStock}`,
        },
      }))
    } catch {
      setFeedbacks((prev) => ({
        ...prev,
        [product.id]: {
          type: 'error',
          message: 'Network error occurred. Please try again.',
        },
      }))
    } finally {
      setSubmittingIds((prev) => ({ ...prev, [product.id]: false }))
    }
  }

  // Logic to execute Stock Out
  async function executeStockOut(product: Product) {
    const qtyValue = quantities[product.id]
    const chosenQty = typeof qtyValue === 'number' && qtyValue > 0 ? qtyValue : 1

    if (!chosenQty || !Number.isFinite(chosenQty) || chosenQty <= 0) {
      setFeedbacks((prev) => ({
        ...prev,
        [product.id]: {
          type: 'error',
          message: 'Please enter a valid quantity greater than 0.',
        },
      }))
      return
    }

    if (chosenQty > product.currentStock) {
      setFeedbacks((prev) => ({
        ...prev,
        [product.id]: {
          type: 'error',
          message: `Only ${product.currentStock} units available at ${warehouseName(product.warehouseId)}. Cannot stock out more than available.`,
        },
      }))
      return
    }

    setSubmittingIds((prev) => ({ ...prev, [product.id]: true }))
    setFeedbacks((prev) => {
      const next = { ...prev }
      delete next[product.id]
      return next
    })

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stock',
          productId: product.id,
          direction: 'OUT',
          quantity: chosenQty,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setFeedbacks((prev) => ({
          ...prev,
          [product.id]: {
            type: 'error',
            message: data.error ?? 'Stock out failed.',
          },
        }))
        return
      }

      if (data.products) {
        setProducts(data.products)
      }

      setFeedbacks((prev) => ({
        ...prev,
        [product.id]: {
          type: 'success',
          message: `✓ Stocked out ${chosenQty} units from ${warehouseName(product.warehouseId)}. Remaining: ${data.product.currentStock}`,
        },
      }))
    } catch {
      setFeedbacks((prev) => ({
        ...prev,
        [product.id]: {
          type: 'error',
          message: 'Network error occurred. Please try again.',
        },
      }))
    } finally {
      setSubmittingIds((prev) => ({ ...prev, [product.id]: false }))
    }
  }

  return (
    <>
      <style jsx>{`
        .stock-dashboard-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }
        .stat-card {
          background: var(--white);
          border: 1px solid var(--steel-light);
          border-radius: var(--radius-sm);
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .stat-card.alert {
          border-left: 4px solid var(--rust);
          background: rgba(139, 74, 63, 0.04);
        }
        .stat-card.normal {
          border-left: 4px solid var(--moss);
        }
        .stat-card-title {
          font-size: 12px;
          color: var(--steel);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 600;
        }
        .stat-card-value {
          font-size: 24px;
          font-weight: 700;
          font-family: var(--font-display);
          color: var(--ink);
          margin-top: 2px;
        }
        .stock-filter-container {
          background: var(--white);
          border: 1px solid var(--steel-light);
          border-radius: var(--radius-sm);
          padding: 14px 16px;
          margin-bottom: 24px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
        }
        .filter-group {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
        }
        .items-box-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 18px;
        }
        .item-box {
          background: var(--white);
          border: 1px solid var(--steel-light);
          border-radius: var(--radius-md);
          display: flex;
          flex-direction: column;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          overflow: hidden;
        }
        .item-box:hover {
          border-color: var(--moss);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
          transform: translateY(-2px);
        }
        .item-box-header {
          padding: 16px 18px 12px;
          border-bottom: 1px solid var(--paper-dim);
          background: #fdfcf9;
        }
        .item-badges {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
          gap: 6px;
          flex-wrap: wrap;
        }
        .item-name {
          font-size: 15px;
          font-weight: 700;
          color: var(--ink);
          margin: 0 0 6px;
          font-family: var(--font-display);
          line-height: 1.3;
        }
        .item-location {
          font-size: 12px;
          color: var(--steel);
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .item-stock-metrics {
          padding: 12px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--white);
          border-bottom: 1px solid var(--paper-dim);
        }
        .metric-col {
          display: flex;
          flex-direction: column;
        }
        .metric-label {
          font-size: 11px;
          color: var(--steel);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .metric-val {
          font-size: 18px;
          font-weight: 700;
          font-family: var(--font-display);
          color: var(--ink);
        }
        .item-action-area {
          padding: 16px 18px;
          background: #faf8f5;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .mode-tabs {
          display: flex;
          background: var(--paper-dim);
          padding: 3px;
          border-radius: var(--radius-sm);
          gap: 2px;
        }
        .mode-tab-btn {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 10px;
          border-radius: calc(var(--radius-sm) - 1px);
          cursor: pointer;
          color: var(--steel);
          transition: all 0.15s ease;
        }
        .mode-tab-btn.active-buy {
          background: var(--moss);
          color: var(--white);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .mode-tab-btn.active-out {
          background: var(--rust);
          color: var(--white);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .form-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .form-row label {
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-soft);
        }
        .form-row select,
        .form-row input {
          width: 100%;
          font-size: 13px;
          padding: 7px 10px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--steel-light);
          background: var(--white);
        }
        .preset-chip-row {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
          margin-top: 4px;
        }
        .preset-chip {
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 600;
          background: var(--paper);
          border: 1px solid var(--steel-light);
          border-radius: var(--radius-sm);
          color: var(--ink-soft);
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .preset-chip:hover {
          background: var(--paper-dim);
          border-color: var(--moss);
          color: var(--moss-dark);
        }
        .action-submit-btn {
          width: 100%;
          padding: 9px 14px;
          font-size: 13px;
          font-weight: 600;
          border-radius: var(--radius-sm);
          border: none;
          cursor: pointer;
          transition: background 0.15s ease, opacity 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .btn-buy {
          background: var(--moss);
          color: var(--white);
        }
        .btn-buy:hover:not(:disabled) {
          background: var(--moss-dark);
        }
        .btn-stockout {
          background: var(--rust);
          color: var(--white);
        }
        .btn-stockout:hover:not(:disabled) {
          background: #733c33;
        }
        .action-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .feedback-banner {
          font-size: 12px;
          padding: 7px 10px;
          border-radius: var(--radius-sm);
          line-height: 1.35;
          animation: feedbackFade 0.2s ease;
        }
        .feedback-banner.success {
          background: rgba(75, 99, 87, 0.12);
          color: var(--moss-dark);
          border: 1px solid rgba(75, 99, 87, 0.3);
        }
        .feedback-banner.error {
          background: rgba(139, 74, 63, 0.1);
          color: var(--rust);
          border: 1px solid rgba(139, 74, 63, 0.3);
        }
        @keyframes feedbackFade {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Helpful Workflow Banner */}
      <aside className="workflow-aside" style={{ marginBottom: '22px' }}>
        <div className="workflow-aside-icon">↕</div>
        <h3>Keep counts current</h3>
        <p>
          Each item card below enables directly purchasing new stock into any warehouse facility, or recording stock-out picks and adjustments.
        </p>
        <div className="workflow-tip">
          <strong>Tip</strong>
          <span>
            Select any destination warehouse on an item card to directly purchase replenishment stock. Stock out is automatically protected against negative inventory.
          </span>
        </div>
      </aside>

      {/* Top Level Summary Metric Cards */}
      <div className="stock-dashboard-stats">
        <div className="stat-card normal">
          <div>
            <div className="stat-card-title">Total Active SKUs</div>
            <div className="stat-card-value">{summaryStats.totalItems}</div>
          </div>
          <span style={{ fontSize: '24px' }}>📦</span>
        </div>

        <div className={`stat-card ${summaryStats.lowStockCount > 0 ? 'alert' : 'normal'}`}>
          <div>
            <div className="stat-card-title">Items Needing Restock</div>
            <div
              className="stat-card-value"
              style={{ color: summaryStats.lowStockCount > 0 ? 'var(--rust)' : 'var(--moss-dark)' }}
            >
              {summaryStats.lowStockCount}
            </div>
          </div>
          <span style={{ fontSize: '24px' }}>
            {summaryStats.lowStockCount > 0 ? '⚠️' : '✅'}
          </span>
        </div>

        <div className="stat-card normal">
          <div>
            <div className="stat-card-title">Total Units On Hand</div>
            <div className="stat-card-value">{summaryStats.totalUnits.toLocaleString()}</div>
          </div>
          <span style={{ fontSize: '24px' }}>🏢</span>
        </div>
      </div>

      {/* Search, Warehouse & Category Filter Bar */}
      <div className="stock-filter-container">
        <div className="filter-group">
          {/* Search box */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search product, SKU or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '260px', paddingLeft: '28px' }}
            />
            <span
              style={{
                position: 'absolute',
                left: '9px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--steel)',
                fontSize: '13px',
              }}
            >
              🔍
            </span>
          </div>

          {/* Warehouse filter */}
          <select
            value={selectedWarehouseFilter}
            onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
            aria-label="Filter by warehouse"
          >
            <option value="all">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          {/* Category filter */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Low stock only checkbox */}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
            />
            <span>Low stock only</span>
          </label>
        </div>

        {/* Sort selector */}
        <div className="filter-group">
          <span style={{ fontSize: '12px', color: 'var(--steel)' }}>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'stock-asc' | 'stock-desc')}
            aria-label="Sort items"
          >
            <option value="name">Product Name (A-Z)</option>
            <option value="stock-asc">Stock: Low to High</option>
            <option value="stock-desc">Stock: High to Low</option>
          </select>
        </div>
      </div>

      {/* Grid: Every Item Has Its Own Dedicated Box */}
      {filteredProducts.length === 0 ? (
        <div className="panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <h3 style={{ marginBottom: '6px' }}>No items match your filters</h3>
          <p style={{ color: 'var(--steel)', fontSize: '13.5px' }}>
            Try clearing the search query or changing the selected warehouse/category filters.
          </p>
        </div>
      ) : (
        <div className="items-box-grid">
          {filteredProducts.map((product) => {
            const status = getStockStatus(product)
            const isCriticalOrLow = isLowStock(product.currentStock, product.reorderThreshold)
            const deficit = Math.max(0, product.reorderThreshold - product.currentStock)

            const currentMode = itemModes[product.id] ?? 'BUY'
            const chosenTargetWh = targetWarehouses[product.id] ?? product.warehouseId
            const enteredQty = quantities[product.id] ?? ''
            const isSubmitting = submittingIds[product.id] ?? false
            const itemFeedback = feedbacks[product.id]

            // Inspect target warehouse current stock for this item name
            const targetWarehouseProduct = products.find(
              (p) =>
                p.warehouseId === chosenTargetWh &&
                p.name.toLowerCase() === product.name.toLowerCase(),
            )
            const targetWarehouseStock = targetWarehouseProduct ? targetWarehouseProduct.currentStock : 0

            return (
              <div key={product.id} className="item-box">
                {/* Box Header */}
                <div className="item-box-header">
                  <div className="item-badges">
                    <span
                      style={{
                        fontSize: '11px',
                        background: 'var(--paper-dim)',
                        padding: '2px 7px',
                        borderRadius: '3px',
                        color: 'var(--steel)',
                        fontWeight: 600,
                      }}
                    >
                      {product.category}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--steel)', fontWeight: 500 }}>
                      #{product.id}
                    </span>
                    <StatusBadge status={status} label={getStockStatusLabel(status)} />
                  </div>

                  <h3 className="item-name">{product.name}</h3>

                  <div className="item-location">
                    <span>🏢</span>
                    <span>{warehouseName(product.warehouseId)}</span>
                  </div>
                </div>

                {/* Stock Metrics Row */}
                <div className="item-stock-metrics">
                  <div className="metric-col">
                    <span className="metric-label">Current Stock</span>
                    <span
                      className="metric-val"
                      style={{ color: isCriticalOrLow ? 'var(--rust)' : 'var(--ink)' }}
                    >
                      {product.currentStock}
                    </span>
                  </div>

                  <div className="metric-col" style={{ textAlign: 'center' }}>
                    <span className="metric-label">Threshold</span>
                    <span className="metric-val" style={{ color: 'var(--steel)' }}>
                      {product.reorderThreshold}
                    </span>
                  </div>

                  <div className="metric-col" style={{ textAlign: 'right' }}>
                    <span className="metric-label">Status</span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: isCriticalOrLow ? 'var(--rust)' : 'var(--moss-dark)',
                      }}
                    >
                      {deficit > 0 ? `Deficit: -${deficit}` : isCriticalOrLow ? 'At threshold' : 'Optimal'}
                    </span>
                  </div>
                </div>

                {/* Action Area: Buy / Stock In & Stock Out */}
                <div className="item-action-area">
                  {/* Mode Selector Tabs */}
                  <div className="mode-tabs">
                    <button
                      type="button"
                      className={`mode-tab-btn ${currentMode === 'BUY' ? 'active-buy' : ''}`}
                      onClick={() => handleModeChange(product.id, 'BUY')}
                    >
                      ⚡ Buy / Stock In
                    </button>
                    <button
                      type="button"
                      className={`mode-tab-btn ${currentMode === 'OUT' ? 'active-out' : ''}`}
                      onClick={() => handleModeChange(product.id, 'OUT')}
                    >
                      📤 Stock Out
                    </button>
                  </div>

                  {/* BUY / STOCK IN PANEL */}
                  {currentMode === 'BUY' ? (
                    <>
                      {/* Warehouse to Buy Into Option */}
                      <div className="form-row">
                        <label htmlFor={`wh-select-${product.id}`}>
                          Select Warehouse to Buy into:
                        </label>
                        <select
                          id={`wh-select-${product.id}`}
                          value={chosenTargetWh}
                          onChange={(e) => handleTargetWarehouseChange(product.id, e.target.value)}
                        >
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} ({w.location})
                            </option>
                          ))}
                        </select>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--steel)',
                            marginTop: '2px',
                          }}
                        >
                          {chosenTargetWh === product.warehouseId
                            ? `Same location (current: ${product.currentStock} units)`
                            : `Selected destination currently has ${targetWarehouseStock} units`}
                        </div>
                      </div>

                      {/* Quantity Input & Presets */}
                      <div className="form-row">
                        <label htmlFor={`qty-buy-${product.id}`}>
                          Units to Buy:
                        </label>
                        <input
                          id={`qty-buy-${product.id}`}
                          type="number"
                          min={1}
                          placeholder={String(getSuggestedQuantity(product))}
                          value={enteredQty}
                          onChange={(e) =>
                            handleQuantityChange(
                              product.id,
                              e.target.value === '' ? '' : Number(e.target.value),
                            )
                          }
                        />

                        {/* Quick Presets */}
                        <div className="preset-chip-row">
                          <span style={{ fontSize: '10.5px', color: 'var(--steel)' }}>
                            Presets:
                          </span>
                          {deficit > 0 && (
                            <button
                              type="button"
                              className="preset-chip"
                              onClick={() => handleQuantityChange(product.id, Math.max(10, deficit))}
                              title="Order exact deficit to reach threshold"
                            >
                              Deficit (+{Math.max(10, deficit)})
                            </button>
                          )}
                          <button
                            type="button"
                            className="preset-chip"
                            onClick={() => handleQuantityChange(product.id, 10)}
                          >
                            +10
                          </button>
                          <button
                            type="button"
                            className="preset-chip"
                            onClick={() => handleQuantityChange(product.id, 25)}
                          >
                            +25
                          </button>
                          <button
                            type="button"
                            className="preset-chip"
                            onClick={() => handleQuantityChange(product.id, 50)}
                          >
                            +50
                          </button>
                          <button
                            type="button"
                            className="preset-chip"
                            onClick={() => handleQuantityChange(product.id, 100)}
                          >
                            +100
                          </button>
                        </div>
                      </div>

                      {/* Action Button to Buy */}
                      <button
                        type="button"
                        className="action-submit-btn btn-buy"
                        disabled={isSubmitting}
                        onClick={() => executeBuy(product)}
                      >
                        {isSubmitting ? (
                          'Purchasing Stock...'
                        ) : (
                          <>
                            <span>⚡</span>
                            <span>
                              Buy{' '}
                              {typeof enteredQty === 'number' && enteredQty > 0
                                ? `+${enteredQty}`
                                : `+${getSuggestedQuantity(product)}`}{' '}
                              Units
                            </span>
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    /* STOCK OUT PANEL */
                    <>
                      <div className="form-row">
                        <label htmlFor={`qty-out-${product.id}`}>
                          Units to Stock Out from {warehouseName(product.warehouseId)}:
                        </label>
                        <input
                          id={`qty-out-${product.id}`}
                          type="number"
                          min={1}
                          max={product.currentStock}
                          placeholder="Enter quantity"
                          value={enteredQty}
                          onChange={(e) =>
                            handleQuantityChange(
                              product.id,
                              e.target.value === '' ? '' : Number(e.target.value),
                            )
                          }
                        />

                        {/* Quick Presets for Stock Out */}
                        <div className="preset-chip-row">
                          <span style={{ fontSize: '10.5px', color: 'var(--steel)' }}>
                            Presets:
                          </span>
                          <button
                            type="button"
                            className="preset-chip"
                            onClick={() => handleQuantityChange(product.id, 5)}
                          >
                            -5
                          </button>
                          <button
                            type="button"
                            className="preset-chip"
                            onClick={() => handleQuantityChange(product.id, 10)}
                          >
                            -10
                          </button>
                          {product.currentStock > 0 && (
                            <button
                              type="button"
                              className="preset-chip"
                              onClick={() => handleQuantityChange(product.id, product.currentStock)}
                              title="Stock out all available units"
                            >
                              All ({product.currentStock})
                            </button>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="action-submit-btn btn-stockout"
                        disabled={isSubmitting || product.currentStock === 0}
                        onClick={() => executeStockOut(product)}
                      >
                        {isSubmitting ? (
                          'Stocking Out...'
                        ) : product.currentStock === 0 ? (
                          'No Units Available'
                        ) : (
                          <>
                            <span>📤</span>
                            <span>
                              Stock Out{' '}
                              {typeof enteredQty === 'number' && enteredQty > 0 ? enteredQty : 1}{' '}
                              Unit
                              {(typeof enteredQty === 'number' && enteredQty > 1) ||
                              enteredQty === ''
                                ? 's'
                                : ''}
                            </span>
                          </>
                        )}
                      </button>
                    </>
                  )}

                  {/* Feedback Message inside the item's box */}
                  {itemFeedback && (
                    <div className={`feedback-banner ${itemFeedback.type}`}>
                      {itemFeedback.message}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
