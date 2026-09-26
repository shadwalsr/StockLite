import {
  products,
  warehouses,
  transactions,
  findProduct,
  applyStockMovement as applyStockMovementInSeed,
  applyTransfer as applyTransferInSeed,
  recordTransaction as recordTransactionInSeed,
} from './seed-data'
import { Product, Transaction, TransactionType, Warehouse } from './types'

export { findProduct }
export const applyStockMovement = applyStockMovementInSeed
export const applyTransfer = applyTransferInSeed

/**
 * Returns all products currently in the store.
 */
export function getAllProducts(): Product[] {
  return products
}

/**
 * Returns all warehouses.
 */
export function getAllWarehouses(): Warehouse[] {
  return warehouses
}

/**
 * Returns all transactions in the store.
 */
export function getAllTransactions(): Transaction[] {
  return transactions
}

/**
 * Finds a warehouse by its ID.
 */
export function getWarehouse(warehouseId: string): Warehouse | undefined {
  return warehouses.find((w) => w.id === warehouseId)
}

/**
 * Finds a product in a specific warehouse by product ID or name match.
 */
export function findProductInWarehouse(
  productId: string,
  warehouseId: string,
): Product | undefined {
  const direct = products.find(
    (p) => p.id === productId && p.warehouseId === warehouseId,
  )
  if (direct) return direct

  const base = findProduct(productId)
  if (!base) return undefined

  return products.find(
    (p) =>
      p.name.toLowerCase() === base.name.toLowerCase() &&
      p.warehouseId === warehouseId,
  )
}

/**
 * getStock(productId, warehouseId): returns current quantity, 0 if no record exists.
 */
export function getStock(productId: string, warehouseId: string): number {
  const item = findProductInWarehouse(productId, warehouseId)
  return item ? item.currentStock : 0
}

/**
 * isLowStock(stock, threshold): returns stock <= threshold.
 * Single source of truth for the low-stock rule.
 */
export function isLowStock(stock: number, threshold: number): boolean {
  return stock <= threshold
}

/**
 * Generates the next sequential product ID formatted as 'p-XXX'.
 */
function getNextProductId(): string {
  let maxNum = 0
  for (const p of products) {
    const match = p.id.match(/^p-(\d+)$/)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > maxNum) maxNum = num
    }
  }
  return `p-${String(maxNum + 1).padStart(3, '0')}`
}

/**
 * applyStockChange(productId, warehouseId, delta):
 * Adjusts stock by a signed delta (positive for stock-in/transfer-in, negative for stock-out/transfer-out),
 * creating a new stock record if one doesn't exist for that product/warehouse pair.
 */
export function applyStockChange(
  productId: string,
  warehouseId: string,
  delta: number,
): Product {
  let target = findProductInWarehouse(productId, warehouseId)

  if (!target) {
    const template = findProduct(productId)
    if (!template) {
      throw new Error(`Product ${productId} not found to derive details from.`)
    }

    target = {
      id: getNextProductId(),
      name: template.name,
      category: template.category,
      warehouseId,
      currentStock: 0,
      reorderThreshold: template.reorderThreshold,
    }
    products.push(target)
  }

  target.currentStock += delta
  return target
}

/**
 * recordTransaction(entry):
 * Appends a correctly-typed transaction record and returns it.
 */
export function recordTransaction(entry: {
  productId: string
  productName: string
  warehouseId: string
  type: TransactionType
  quantity: number
  linkedTransactionId?: string
}): Transaction {
  return recordTransactionInSeed(entry)
}
