'use client'

import { useEffect, useMemo, useState } from 'react'
import { Transaction } from '@/lib/types'

const TYPE_LABELS: Record<string, string> = {
  IN: 'Stock in',
  OUT: 'Stock out',
  TRANSFER_OUT: 'Transfer out',
  TRANSFER_IN: 'Transfer in',
}

export default function TransactionTable({
  transactions: initialTransactions,
}: {
  transactions: Transaction[]
}) {
  const [data, setData] = useState(initialTransactions)

  useEffect(() => {
    fetch('/api/transactions')
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => {
        if (resData?.transactions) {
          setData(resData.transactions)
        }
      })
      .catch(() => {})
  }, [])

  const warehouseOptions = useMemo(
    () => Array.from(new Set(data.map((t) => t.warehouseName))).sort(),
    [data],
  )

  const [typeFilter, setTypeFilter] = useState('all')
  const [warehouseFilter, setWarehouseFilter] = useState('all')

  const visibleTransactions = useMemo(() => {
    return [...data]
      .filter((t) => typeFilter === 'all' || t.type === typeFilter)
      .filter(
        (t) => warehouseFilter === 'all' || t.warehouseName === warehouseFilter,
      )
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
  }, [data, typeFilter, warehouseFilter])

  return (
    <>
      <div className="filter-bar">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="all">All types</option>
          <option value="IN">Stock in</option>
          <option value="OUT">Stock out</option>
          <option value="TRANSFER_OUT">Transfer out</option>
          <option value="TRANSFER_IN">Transfer in</option>
        </select>

        <select
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          aria-label="Filter by warehouse"
        >
          <option value="all">All warehouses</option>
          {warehouseOptions.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>

      <div className="panel table-panel">
        {visibleTransactions.length === 0 ? (
          <div className="empty-state">
            <h3>No transactions match these filters</h3>
            <p>Try a different type or warehouse.</p>
          </div>
        ) : (
          <div className="table-scroll" tabIndex={0} aria-label="Transaction history table">
            <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Warehouse</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {visibleTransactions.map((t) => (
                <tr key={t.id}>
                  <td>{t.productName}</td>
                  <td>{t.warehouseName}</td>
                  <td>
                    <span>{TYPE_LABELS[t.type] ?? t.type}</span>
                    {t.linkedTransactionId && (
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '11px',
                          marginLeft: '6px',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: 'rgba(0, 0, 0, 0.06)',
                          color: '#555',
                        }}
                        title={`Paired with transaction ${t.linkedTransactionId}`}
                      >
                        ⇄ {t.linkedTransactionId}
                      </span>
                    )}
                  </td>
                  <td>{t.quantity}</td>
                  <td>{new Date(t.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
