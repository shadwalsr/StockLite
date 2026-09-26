'use client'

import { useState } from 'react'
import { Product } from '@/lib/types'

export default function StockForm({
  products: initialProducts,
}: {
  products: Product[]
}) {
  const [products, setProducts] = useState(initialProducts)
  const [productId, setProductId] = useState(initialProducts[0]?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedProduct = products.find((p) => p.id === productId)
  const stockPercent = selectedProduct
    ? Math.min(
        100,
        Math.round((selectedProduct.currentStock / Math.max(selectedProduct.reorderThreshold * 2, 1)) * 100),
      )
    : 0

  async function submitMovement(direction: 'IN' | 'OUT') {
    setError('')
    setSuccess('')

    const parsedQuantity = Number(quantity)
    if (!quantity || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Enter a quantity greater than 0.')
      return
    }
    if (
      direction === 'OUT' &&
      selectedProduct &&
      parsedQuantity > selectedProduct.currentStock
    ) {
      setError(
        `Only ${selectedProduct.currentStock} in stock — cannot stock out more than that.`,
      )
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stock',
          productId,
          quantity: parsedQuantity,
          direction,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }
      setProducts((prev) =>
        data.products ??
        prev.map((p) => (p.id === data.product.id ? data.product : p)),
      )
      setSuccess(
        `${direction === 'IN' ? 'Stocked in' : 'Stocked out'} ${parsedQuantity} unit${parsedQuantity === 1 ? '' : 's'} of ${data.product.name}.`,
      )
      setQuantity('')
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="workflow-layout">
      <div className="panel form-panel workflow-form-panel">
        <div className="workflow-heading">
          <span className="workflow-kicker">Movement desk</span>
          <h2>Record stock movement</h2>
          <p>Update inventory in one step and keep the audit trail accurate.</p>
        </div>
      <form>
        <div className="form-field">
          <label htmlFor="product">Product</label>
          <select
            id="product"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.warehouseId} ({p.currentStock} on hand)
              </option>
            ))}
          </select>
        </div>

        {selectedProduct && (
          <div className="selection-card">
            <div>
              <strong>{selectedProduct.name}</strong>
              <span>{selectedProduct.category} · {selectedProduct.warehouseId}</span>
            </div>
            <div className="selection-stock">
              <strong>{selectedProduct.currentStock}</strong>
              <span>units on hand</span>
            </div>
            <div className="stock-meter" aria-label={`${selectedProduct.currentStock} units on hand`}>
              <span style={{ width: `${stockPercent}%` }} />
            </div>
            <small>Reorder point: {selectedProduct.reorderThreshold} units</small>
          </div>
        )}

        <div className="form-field">
          <label htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            type="number"
            min={1}
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <div className="quick-quantities" aria-label="Quick quantity selection">
            {[1, 10, 25, 50].map((amount) => (
              <button key={amount} type="button" onClick={() => setQuantity(String(amount))}>
                {amount}
              </button>
            ))}
          </div>
        </div>

        <div className="form-error">{error}</div>
        {!error && success && (
          <p
            style={{
              fontSize: 12.5,
              color: 'var(--moss-dark)',
              margin: '-10px 0 12px',
            }}
          >
            {success}
          </p>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={submitting}
            onClick={() => submitMovement('IN')}
          >
            Stock in
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={submitting}
            onClick={() => submitMovement('OUT')}
          >
            Stock out
          </button>
        </div>
      </form>
      </div>
      <aside className="workflow-aside">
        <div className="workflow-aside-icon">↕</div>
        <h3>Keep counts current</h3>
        <p>Use Stock in for receipts and Stock out for picks, damage, or adjustments.</p>
        <div className="workflow-tip"><strong>Tip</strong><span>Stock out is blocked when the requested amount exceeds available inventory.</span></div>
      </aside>
    </div>
  )
}
