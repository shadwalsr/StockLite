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
        <div className="stock-stat-card normal">
          <div>
            <div className="stock-stat-title">Total Active SKUs</div>
            <div className="stock-stat-value">{summaryStats.totalItems}</div>
          </div>
          <span className="stock-stat-icon">📦</span>
        </div>

        <div className={`stock-stat-card ${summaryStats.lowStockCount > 0 ? 'alert' : 'normal'}`}>
          <div>
            <div className="stock-stat-title">Items Needing Restock</div>
            <div
              className="stock-stat-value"
              style={{ color: summaryStats.lowStockCount > 0 ? 'var(--rust)' : 'var(--moss-dark)' }}
            >
              {summaryStats.lowStockCount}
            </div>
          </div>
          <span className="stock-stat-icon">
            {summaryStats.lowStockCount > 0 ? '⚠️' : '✅'}
          </span>
        </div>

        <div className="stock-stat-card normal">
          <div>
            <div className="stock-stat-title">Total Units On Hand</div>
            <div className="stock-stat-value">{summaryStats.totalUnits.toLocaleString()}</div>
          </div>
          <span className="stock-stat-icon">🏢</span>
        </div>
      </div>

      {/* Search, Warehouse & Category Filter Bar */}
      <div className="stock-filter-container">
        <div className="stock-filter-group">
          {/* Search box */}
          <div className="stock-search-wrap">
            <span className="stock-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search product, SKU or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="stock-search-input"
            />
          </div>

          {/* Warehouse filter */}
          <select
            value={selectedWarehouseFilter}
            onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
            className="stock-select"
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
            className="stock-select"
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
          <label className="stock-checkbox-label">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
            />
            <span>Low stock only</span>
          </label>
        </div>

        {/* Sort selector */}
        <div className="stock-filter-group">
          <span style={{ fontSize: '12px', color: 'var(--steel)' }}>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'stock-asc' | 'stock-desc')}
            className="stock-select"
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

            const stockPercent = Math.min(
              100,
              Math.round((product.currentStock / Math.max(product.reorderThreshold * 2, 1)) * 100),
            )

            return (
              <div
                key={product.id}
                className={`item-box ${isCriticalOrLow ? 'alert-border' : 'normal-border'}`}
              >
                {/* Box Header */}
                <div className="item-box-header">
                  <div className="item-badges">
                    <span className="item-category-chip">{product.category}</span>
                    <span className="item-sku-tag">#{product.id}</span>
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

                {/* Visual Stock Meter Bar */}
                <div style={{ padding: '0 18px 10px', background: 'var(--white)' }}>
                  <div className="stock-meter" style={{ marginTop: '8px' }}>
                    <span
                      style={{
                        width: `${stockPercent}%`,
                        backgroundColor: isCriticalOrLow ? 'var(--rust)' : 'var(--moss)',
                      }}
                    />
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
                      <div className="box-form-row">
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
                      <div className="box-form-row">
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
                      <div className="box-form-row">
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
