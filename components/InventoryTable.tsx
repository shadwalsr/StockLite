'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Product,
  Warehouse,
  getStockStatus,
  getStockStatusLabel,
} from '@/lib/types'
import { isLowStock } from '@/lib/inventory-store'
import StatusBadge from '@/components/StatusBadge'

export default function InventoryTable({
  products: initialProducts,
  warehouses,
}: {
  products: Product[]
  warehouses: Warehouse[]
}) {
  const [products, setProducts] = useState(initialProducts)
  const [expandedWarehouseId, setExpandedWarehouseId] = useState<string | null>(
    null,
  )
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({})
  const [restockingId, setRestockingId] = useState<string | null>(null)
  const [bulkRestocking, setBulkRestocking] = useState(false)
  const [feedback, setFeedback] = useState<
    Record<string, { type: 'success' | 'error'; message: string }>
  >({})

  useEffect(() => {
    fetch('/api/items')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.products) {
          setProducts(data.products)
        }
      })
      .catch(() => {})
  }, [])

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products],
  )
  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name ?? id

  const [selectedCategory, setSelectedCategory] = useState('all')
  const [lowStockOnly, setLowStockOnly] = useState(false)

  const visibleProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory)
        return false
      if (lowStockOnly && !isLowStock(p.currentStock, p.reorderThreshold))
        return false
      return true
    })
  }, [products, selectedCategory, lowStockOnly])

  const warehouseLowStockSummary = useMemo(() => {
    return warehouses.map((w) => {
      const warehouseProds = products.filter((p) => p.warehouseId === w.id)
      const lowStockItems = warehouseProds.filter((p) =>
        isLowStock(p.currentStock, p.reorderThreshold),
      )
      return {
        ...w,
        totalSkus: warehouseProds.length,
        lowStockCount: lowStockItems.length,
        lowStockItems,
      }
    })
  }, [products, warehouses])

  function getSuggestedQuantity(product: Product): number {
    const deficit = Math.max(1, product.reorderThreshold - product.currentStock)
    return Math.max(10, deficit + Math.ceil(product.reorderThreshold * 0.5))
  }

  function handleQuantityChange(productId: string, val: number) {
    setBuyQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(1, Math.floor(val)),
    }))
  }

  async function handleBuyStock(product: Product, customQty?: number) {
    const qty =
      customQty ?? buyQuantities[product.id] ?? getSuggestedQuantity(product)
    if (!qty || !Number.isFinite(qty) || qty <= 0) {
      setFeedback((prev) => ({
        ...prev,
        [product.id]: {
          type: 'error',
          message: 'Quantity must be a positive number greater than 0',
        },
      }))
      return
    }

    setRestockingId(product.id)
    setFeedback((prev) => {
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
          quantity: qty,
          direction: 'IN',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedback((prev) => ({
          ...prev,
          [product.id]: {
            type: 'error',
            message: data.error ?? 'Restock failed.',
          },
        }))
        return
      }

      if (data.products) {
        setProducts(data.products)
      }

      setFeedback((prev) => ({
        ...prev,
        [product.id]: {
          type: 'success',
          message: `✓ Restocked +${qty} units! Stock now at ${data.product.currentStock}.`,
        },
      }))
    } catch {
      setFeedback((prev) => ({
        ...prev,
        [product.id]: {
          type: 'error',
          message: 'Network error. Please try again.',
        },
      }))
    } finally {
      setRestockingId(null)
    }
  }

  async function handleRestockAll(warehouseItems: Product[]) {
    if (warehouseItems.length === 0) return
    setBulkRestocking(true)
    try {
      for (const item of warehouseItems) {
        const qty = buyQuantities[item.id] ?? getSuggestedQuantity(item)
        const res = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'stock',
            productId: item.id,
            quantity: qty,
            direction: 'IN',
          }),
        })
        const data = await res.json()
        if (res.ok && data.products) {
          setProducts(data.products)
        }
      }
    } catch {
      // handled
    } finally {
      setBulkRestocking(false)
    }
  }

  const activeWarehouse = warehouseLowStockSummary.find(
    (w) => w.id === expandedWarehouseId,
  )

  return (
    <>
      <style>{`
        @keyframes restockSlideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulseAlert {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.6; }
        }
        .preset-chip {
          padding: 3px 8px;
          font-size: 11.5px;
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
        .restock-item-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--steel-light);
          background: var(--white);
          gap: 16px;
          flex-wrap: wrap;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .restock-item-card:hover {
          border-color: var(--steel);
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
      `}</style>

      <div className="summary-strip">
        <div className="summary-tile">
          <div className="value">{products.length}</div>
          <div className="label">Total SKUs tracked</div>
        </div>
        <div className="summary-tile">
          <div className="value">{warehouses.length}</div>
          <div className="label">Warehouses</div>
        </div>
        <div className="summary-tile">
          <div className="value">{categories.length}</div>
          <div className="label">Categories</div>
        </div>
        <div className="summary-tile">
          <div className="value">
            {products.reduce((sum, p) => sum + p.currentStock, 0)}
          </div>
          <div className="label">Units on hand</div>
        </div>
      </div>

      {/* Low Stock Replenishment Summary with Restock Dropdown */}
      <div
        className="panel"
        style={{ padding: '18px 22px', marginBottom: '22px' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--ink)' }}>
                Low Stock Replenishment Summary
              </h3>
              {warehouseLowStockSummary.some((w) => w.lowStockCount > 0) && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(139, 74, 63, 0.14)',
                    color: 'var(--rust)',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--rust)',
                      display: 'inline-block',
                      animation: 'pulseAlert 1.6s infinite ease-in-out',
                    }}
                  />
                  Replenishment Required
                </span>
              )}
            </div>
            <p
              style={{
                margin: '3px 0 0',
                fontSize: '12.5px',
                color: 'var(--steel)',
              }}
            >
              Real-time monitoring across facilities. Click any warehouse alert
              to directly purchase and restock items.
            </p>
          </div>
        </div>

        {/* Warehouse Card Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '14px',
          }}
        >
          {warehouseLowStockSummary.map((w) => {
            const hasAlert = w.lowStockCount > 0
            const isExpanded = expandedWarehouseId === w.id

            return (
              <div
                key={w.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  background: isExpanded
                    ? 'var(--white)'
                    : hasAlert
                      ? 'rgba(139, 74, 63, 0.06)'
                      : 'rgba(75, 99, 87, 0.06)',
                  border: isExpanded
                    ? '2px solid var(--moss)'
                    : hasAlert
                      ? '1px solid rgba(139, 74, 63, 0.3)'
                      : '1px solid rgba(75, 99, 87, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: isExpanded
                    ? '0 4px 14px rgba(0,0,0,0.06)'
                    : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '10px',
                    marginBottom: '10px',
                  }}
                >
                  <div>
                    <strong
                      style={{
                        fontSize: '14px',
                        color: 'var(--ink)',
                        display: 'block',
                      }}
                    >
                      {w.name}
                    </strong>
                    <div style={{ fontSize: '12px', color: 'var(--steel)' }}>
                      {w.location} · {w.totalSkus} SKUs
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontSize: '20px',
                        fontWeight: 700,
                        fontFamily: 'var(--font-display)',
                        color: hasAlert ? 'var(--rust)' : 'var(--moss-dark)',
                      }}
                    >
                      {w.lowStockCount}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--steel)',
                        display: 'block',
                      }}
                    >
                      {w.lowStockCount === 1 ? 'item low' : 'items low'}
                    </span>
                  </div>
                </div>

                {/* Restock Trigger Button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--paper-dim)',
                  }}
                >
                  {hasAlert ? (
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--rust)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      ⚠ Needs restock
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--moss-dark)',
                        fontWeight: 500,
                      }}
                    >
                      ✓ Stock healthy
                    </span>
                  )}

                  {hasAlert ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedWarehouseId((prev) =>
                          prev === w.id ? null : w.id,
                        )
                      }
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-sm)',
                        border: isExpanded
                          ? '1px solid var(--moss)'
                          : '1px solid var(--rust)',
                        background: isExpanded
                          ? 'var(--moss)'
                          : 'rgba(139, 74, 63, 0.1)',
                        color: isExpanded ? 'var(--white)' : 'var(--rust)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>
                        {isExpanded ? 'Close Menu' : 'Click to Restock'}
                      </span>
                      <span
                        style={{
                          display: 'inline-block',
                          transform: isExpanded
                            ? 'rotate(180deg)'
                            : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                          fontSize: '13px',
                        }}
                      >
                        ▾
                      </span>
                    </button>
                  ) : (
                    <span style={{ fontSize: '11.5px', color: 'var(--steel)' }}>
                      Optimal levels
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Smooth Expandable Restock Dropdown Menu */}
        {activeWarehouse && (
          <div
            style={{
              marginTop: '18px',
              padding: '18px 20px',
              background: 'var(--white)',
              border: '1px solid var(--steel-light)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
              animation:
                'restockSlideDown 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Dropdown Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                paddingBottom: '14px',
                borderBottom: '1px solid var(--paper-dim)',
                marginBottom: '14px',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '16px' }}>📦</span>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      fontFamily: 'var(--font-display)',
                      color: 'var(--ink)',
                    }}
                  >
                    Quick Restock Menu — {activeWarehouse.name}
                  </h4>
                </div>
                <p
                  style={{
                    margin: '3px 0 0',
                    fontSize: '12.5px',
                    color: 'var(--steel)',
                  }}
                >
                  Directly order replenishment stock for all depleted SKUs at
                  this location.
                </p>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
              >
                {activeWarehouse.lowStockItems.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      fontSize: '12.5px',
                      padding: '7px 14px',
                      minHeight: '34px',
                    }}
                    disabled={bulkRestocking}
                    onClick={() =>
                      handleRestockAll(activeWarehouse.lowStockItems)
                    }
                  >
                    {bulkRestocking
                      ? 'Restocking All...'
                      : `⚡ Restock All (${activeWarehouse.lowStockItems.length} SKUs)`}
                  </button>
                )}
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '18px',
                    cursor: 'pointer',
                    color: 'var(--steel)',
                    padding: '4px 8px',
                  }}
                  title="Close restock menu"
                  onClick={() => setExpandedWarehouseId(null)}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Empty state if all items in this warehouse have been restocked */}
            {activeWarehouse.lowStockItems.length === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: 'var(--moss-dark)',
                  background: 'rgba(75, 99, 87, 0.08)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div style={{ fontSize: '24px', marginBottom: '6px' }}>🎉</div>
                <strong style={{ fontSize: '14px' }}>
                  All items are now restocked above threshold!
                </strong>
                <p
                  style={{
                    fontSize: '12.5px',
                    color: 'var(--steel)',
                    margin: '4px 0 0',
                  }}
                >
                  Inventory at {activeWarehouse.name} is fully healthy.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {activeWarehouse.lowStockItems.map((product) => {
                  const suggested = getSuggestedQuantity(product)
                  const chosenQty = buyQuantities[product.id] ?? suggested
                  const isRestocking = restockingId === product.id
                  const fb = feedback[product.id]
                  const deficit = Math.max(
                    0,
                    product.reorderThreshold - product.currentStock,
                  )

                  return (
                    <div key={product.id} className="restock-item-card">
                      {/* Left: Product Info */}
                      <div style={{ flex: '1 1 240px' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <strong
                            style={{ fontSize: '14px', color: 'var(--ink)' }}
                          >
                            {product.name}
                          </strong>
                          <span
                            style={{
                              fontSize: '11px',
                              background: 'var(--paper-dim)',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              color: 'var(--steel)',
                            }}
                          >
                            {product.category}
                          </span>
                          <span
                            style={{ fontSize: '11px', color: 'var(--steel)' }}
                          >
                            #{product.id}
                          </span>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginTop: '6px',
                            fontSize: '12.5px',
                          }}
                        >
                          <span>
                            Current:{' '}
                            <strong style={{ color: 'var(--rust)' }}>
                              {product.currentStock}
                            </strong>
                          </span>
                          <span style={{ color: 'var(--steel)' }}>
                            Threshold: {product.reorderThreshold}
                          </span>
                          <span
                            style={{
                              fontSize: '11.5px',
                              color: 'var(--rust)',
                              fontWeight: 600,
                            }}
                          >
                            {deficit === 0
                              ? 'At threshold'
                              : `Deficit: -${deficit} units`}
                          </span>
                        </div>

                        {/* Inline Feedback Toast */}
                        {fb && (
                          <div
                            style={{
                              marginTop: '6px',
                              fontSize: '12px',
                              fontWeight: 500,
                              color:
                                fb.type === 'success'
                                  ? 'var(--moss-dark)'
                                  : 'var(--rust)',
                            }}
                          >
                            {fb.message}
                          </div>
                        )}
                      </div>

                      {/* Right: Quantity Selector & Buy Stock Action */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          flexWrap: 'wrap',
                        }}
                      >
                        {/* Quick Presets */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '11px',
                              color: 'var(--steel)',
                              marginRight: '2px',
                            }}
                          >
                            Presets:
                          </span>
                          <button
                            type="button"
                            className="preset-chip"
                            onClick={() =>
                              handleQuantityChange(
                                product.id,
                                Math.max(10, deficit),
                              )
                            }
                            title="Order exact deficit"
                          >
                            Min (+{Math.max(10, deficit)})
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
                            onClick={() =>
                              handleQuantityChange(product.id, 100)
                            }
                          >
                            +100
                          </button>
                        </div>

                        {/* Quantity Input */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <input
                            type="number"
                            min={1}
                            style={{
                              width: '72px',
                              padding: '6px 8px',
                              fontSize: '13px',
                              textAlign: 'center',
                              minHeight: '34px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--steel-light)',
                            }}
                            value={chosenQty}
                            onChange={(e) =>
                              handleQuantityChange(
                                product.id,
                                Number(e.target.value),
                              )
                            }
                          />
                        </div>

                        {/* Direct Buy Stock Button */}
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{
                            minHeight: '34px',
                            padding: '6px 14px',
                            fontSize: '12.5px',
                            whiteSpace: 'nowrap',
                          }}
                          disabled={isRestocking}
                          onClick={() => handleBuyStock(product, chosenQty)}
                        >
                          {isRestocking
                            ? 'Buying...'
                            : `⚡ Buy +${chosenQty} Units`}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="filter-bar">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className="checkbox-filter">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
          />
          Low stock only
        </label>
      </div>

      <div className="panel table-panel">
        {visibleProducts.length === 0 ? (
          <div className="empty-state">
            <h3>No products match these filters</h3>
            <p>Try a different category or clear the low stock filter.</p>
          </div>
        ) : (
          <div
            className="table-scroll"
            tabIndex={0}
            aria-label="Inventory table"
          >
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Warehouse</th>
                  <th>Current stock</th>
                  <th>Reorder threshold</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((product) => {
                  const status = getStockStatus(product)
                  return (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{product.category}</td>
                      <td>{warehouseName(product.warehouseId)}</td>
                      <td>{product.currentStock}</td>
                      <td>{product.reorderThreshold}</td>
                      <td>
                        <StatusBadge
                          status={status}
                          label={getStockStatusLabel(status)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
