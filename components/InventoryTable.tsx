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
      const lowStockCount = warehouseProds.filter((p) =>
        isLowStock(p.currentStock, p.reorderThreshold),
      ).length
      return {
        ...w,
        totalSkus: warehouseProds.length,
        lowStockCount,
      }
    })
  }, [products, warehouses])

  return (
    <>
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

      <div
        className="panel"
        style={{ padding: '16px 20px', marginBottom: '20px' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--ink)' }}>
              Low Stock Replenishment Summary
            </h3>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: '12.5px',
                color: 'var(--steel)',
              }}
            >
              Products requiring replenishment (current stock ≤ reorder
              threshold)
            </p>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '12px',
          }}
        >
          {warehouseLowStockSummary.map((w) => (
            <div
              key={w.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background:
                  w.lowStockCount > 0
                    ? 'rgba(139, 74, 63, 0.08)'
                    : 'rgba(75, 99, 87, 0.08)',
                border: `1px solid ${
                  w.lowStockCount > 0
                    ? 'rgba(139, 74, 63, 0.25)'
                    : 'rgba(75, 99, 87, 0.25)'
                }`,
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div>
                <strong style={{ fontSize: '13.5px', color: 'var(--ink)' }}>
                  {w.name}
                </strong>
                <div style={{ fontSize: '12px', color: 'var(--steel)' }}>
                  {w.location}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    color:
                      w.lowStockCount > 0
                        ? 'var(--rust)'
                        : 'var(--moss-dark)',
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
          ))}
        </div>
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
          <div className="table-scroll" tabIndex={0} aria-label="Inventory table">
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
