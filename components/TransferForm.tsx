'use client'

import { useMemo, useState } from 'react'
import { Product, Warehouse } from '@/lib/types'

export default function TransferForm({
  products: initialProducts,
  warehouses,
}: {
  products: Product[]
  warehouses: Warehouse[]
}) {
  const [products, setProducts] = useState(initialProducts)
  const [sourceWarehouseId, setSourceWarehouseId] = useState(
    warehouses[0]?.id ?? '',
  )
  const [destWarehouseId, setDestWarehouseId] = useState(
    warehouses[1]?.id ?? '',
  )

  const sourceProducts = useMemo(
    () => products.filter((p) => p.warehouseId === sourceWarehouseId),
    [products, sourceWarehouseId],
  )
  const [productId, setProductId] = useState(sourceProducts[0]?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleSourceChange(id: string) {
    setSourceWarehouseId(id)
    const firstAtSource = products.find((p) => p.warehouseId === id)
    setProductId(firstAtSource?.id ?? '')
    if (id === destWarehouseId) {
      const alt = warehouses.find((w) => w.id !== id)
      if (alt) setDestWarehouseId(alt.id)
    }
  }

  const selectedProduct = products.find((p) => p.id === productId)
  const sourceWarehouse = warehouses.find((w) => w.id === sourceWarehouseId)
  const destWarehouse = warehouses.find((w) => w.id === destWarehouseId)

  // TASK 3: This currently sends the transfer request with no validation at
  // all, and doesn't update the UI afterward. Add checks before calling the
  // API:
  //   - source and destination warehouses must be different
  //   - a product must be selected
  //   - quantity must be a positive number and <= selectedProduct.currentStock
  // Then, after a successful response, update `products` state using
  // data.source and data.destination (add the destination row if it's new).
  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!productId) {
      setError('Please select a product.')
      return
    }

    if (sourceWarehouseId === destWarehouseId) {
      setError('Source and destination warehouses must be different.')
      return
    }

    const parsedQuantity = Number(quantity)
    if (!quantity || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Enter a quantity greater than 0.')
      return
    }

    if (selectedProduct && parsedQuantity > selectedProduct.currentStock) {
      setError(
        `Only ${selectedProduct.currentStock} in stock — cannot transfer more than that.`,
      )
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transfer',
          productId,
          destWarehouseId,
          quantity: parsedQuantity,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }

      if (data.products) {
        setProducts(data.products)
      } else {
        setProducts((prev) => {
          const next = prev.map((p) => {
            if (p.id === data.source.id) return data.source
            if (p.id === data.destination.id) return data.destination
            return p
          })
          if (!next.some((p) => p.id === data.destination.id)) {
            next.push(data.destination)
          }
          return next
        })
      }

      setSuccess(
        `Transferred ${parsedQuantity} unit${parsedQuantity === 1 ? '' : 's'} of ${data.source.name} to the destination warehouse.`,
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
          <h2>Move inventory safely</h2>
          <p>Choose a source, destination, and quantity. Both sides update together.</p>
        </div>
      <form onSubmit={handleTransfer}>
        <div className="form-field">
          <label htmlFor="source">Source warehouse</label>
          <select
            id="source"
            value={sourceWarehouseId}
            onChange={(e) => handleSourceChange(e.target.value)}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div className="transfer-route" aria-label="Transfer route">
          <div><span>From</span><strong>{sourceWarehouse?.name ?? 'Select source'}</strong></div>
          <span className="transfer-arrow" aria-hidden="true">→</span>
          <div><span>To</span><strong>{destWarehouse?.name ?? 'Select destination'}</strong></div>
        </div>

        <div className="form-field">
          <label htmlFor="t-product">Product</label>
          <select
            id="t-product"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={sourceProducts.length === 0}
          >
            {sourceProducts.length === 0 ? (
              <option value="">No products at this warehouse</option>
            ) : (
              sourceProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.currentStock} on hand)
                </option>
              ))
            )}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="dest">Destination warehouse</label>
          <select
            id="dest"
            value={destWarehouseId}
            onChange={(e) => setDestWarehouseId(e.target.value)}
          >
            {warehouses
              .filter((w) => w.id !== sourceWarehouseId)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="t-quantity">Quantity</label>
          <input
            id="t-quantity"
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

        {selectedProduct && (
          <div className="selection-card transfer-selection">
            <div>
              <strong>{selectedProduct.name}</strong>
              <span>{selectedProduct.category}</span>
            </div>
            <div className="selection-stock">
              <strong>{selectedProduct.currentStock}</strong>
              <span>available to move</span>
            </div>
          </div>
        )}

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
            className="btn btn-primary"
            type="submit"
            disabled={submitting}
          >
            Transfer stock
          </button>
        </div>
      </form>
      </div>
      <aside className="workflow-aside">
        <div className="workflow-aside-icon">⇄</div>
        <h3>Balanced transfers</h3>
        <p>Transfers create a paired outgoing and incoming record so every move stays traceable.</p>
        <div className="workflow-tip"><strong>Protected</strong><span>Source and destination must differ, and stock can never go negative.</span></div>
      </aside>
    </div>
  )
}
