import { Product, Transaction, TransactionType, Warehouse } from './types'

export const warehouses: Warehouse[] = [
  {
    id: 'wh-north',
    name: 'North Distribution Center',
    location: 'Elkridge, MD',
  },
  { id: 'wh-south', name: 'South Fulfillment Hub', location: 'Waco, TX' },
]

const initialProducts: Product[] = [
  {
    id: 'p-001',
    name: 'Corrugated Shipping Box (M)',
    category: 'Packaging',
    warehouseId: 'wh-north',
    currentStock: 420,
    reorderThreshold: 100,
  },
  {
    id: 'p-002',
    name: 'Corrugated Shipping Box (M)',
    category: 'Packaging',
    warehouseId: 'wh-south',
    currentStock: 38,
    reorderThreshold: 100,
  },
  {
    id: 'p-003',
    name: 'Stretch Wrap Film 18in',
    category: 'Packaging',
    warehouseId: 'wh-north',
    currentStock: 64,
    reorderThreshold: 60,
  },
  {
    id: 'p-004',
    name: 'Stretch Wrap Film 18in',
    category: 'Packaging',
    warehouseId: 'wh-south',
    currentStock: 15,
    reorderThreshold: 60,
  },
  {
    id: 'p-005',
    name: 'Packing Tape, Clear 48mm',
    category: 'Packaging',
    warehouseId: 'wh-north',
    currentStock: 210,
    reorderThreshold: 80,
  },
  {
    id: 'p-006',
    name: 'Heavy-Duty Pallet Jack',
    category: 'Equipment',
    warehouseId: 'wh-south',
    currentStock: 6,
    reorderThreshold: 5,
  },
  {
    id: 'p-007',
    name: 'Heavy-Duty Pallet Jack',
    category: 'Equipment',
    warehouseId: 'wh-north',
    currentStock: 3,
    reorderThreshold: 5,
  },
  {
    id: 'p-008',
    name: 'Steel Shelving Unit 5-Tier',
    category: 'Equipment',
    warehouseId: 'wh-north',
    currentStock: 12,
    reorderThreshold: 4,
  },
  {
    id: 'p-009',
    name: 'Forklift Safety Vest',
    category: 'Safety',
    warehouseId: 'wh-south',
    currentStock: 25,
    reorderThreshold: 20,
  },
  {
    id: 'p-010',
    name: 'Forklift Safety Vest',
    category: 'Safety',
    warehouseId: 'wh-north',
    currentStock: 20,
    reorderThreshold: 20,
  },
  {
    id: 'p-011',
    name: 'Nitrile Gloves (Box of 100)',
    category: 'Safety',
    warehouseId: 'wh-north',
    currentStock: 140,
    reorderThreshold: 50,
  },
  {
    id: 'p-012',
    name: 'Nitrile Gloves (Box of 100)',
    category: 'Safety',
    warehouseId: 'wh-south',
    currentStock: 9,
    reorderThreshold: 50,
  },
  {
    id: 'p-013',
    name: 'First Aid Kit, Wall-Mount',
    category: 'Safety',
    warehouseId: 'wh-south',
    currentStock: 8,
    reorderThreshold: 8,
  },
  {
    id: 'p-014',
    name: 'Handheld Barcode Scanner',
    category: 'Electronics',
    warehouseId: 'wh-north',
    currentStock: 18,
    reorderThreshold: 6,
  },
  {
    id: 'p-015',
    name: 'Handheld Barcode Scanner',
    category: 'Electronics',
    warehouseId: 'wh-south',
    currentStock: 4,
    reorderThreshold: 6,
  },
  {
    id: 'p-016',
    name: 'Label Printer, Thermal',
    category: 'Electronics',
    warehouseId: 'wh-north',
    currentStock: 9,
    reorderThreshold: 3,
  },
  {
    id: 'p-017',
    name: 'Warehouse Radio, Two-Way',
    category: 'Electronics',
    warehouseId: 'wh-south',
    currentStock: 11,
    reorderThreshold: 10,
  },
  {
    id: 'p-018',
    name: 'Wooden Pallet, Standard',
    category: 'Materials',
    warehouseId: 'wh-north',
    currentStock: 320,
    reorderThreshold: 150,
  },
  {
    id: 'p-019',
    name: 'Wooden Pallet, Standard',
    category: 'Materials',
    warehouseId: 'wh-south',
    currentStock: 132,
    reorderThreshold: 150,
  },
  {
    id: 'p-020',
    name: 'Cardboard Dunnage Sheets',
    category: 'Materials',
    warehouseId: 'wh-south',
    currentStock: 55,
    reorderThreshold: 55,
  },
]

const globalStore = globalThis as unknown as {
  _stocklite_products?: Product[]
  _stocklite_transactions?: Transaction[]
  _stocklite_nextTxSeq?: number
}

export const products: Product[] =
  globalStore._stocklite_products ??
  (globalStore._stocklite_products = initialProducts)

// A few sample transactions so the History page isn't empty on first load.
const initialTransactions: Transaction[] = [
  {
    id: 't-001',
    productId: 'p-002',
    productName: 'Corrugated Shipping Box (M)',
    warehouseId: 'wh-south',
    warehouseName: 'South Fulfillment Hub',
    type: 'OUT',
    quantity: 62,
    timestamp: '2026-09-15T14:32:00Z',
  },
  {
    id: 't-002',
    productId: 'p-018',
    productName: 'Wooden Pallet, Standard',
    warehouseId: 'wh-north',
    warehouseName: 'North Distribution Center',
    type: 'IN',
    quantity: 100,
    timestamp: '2026-09-16T09:05:00Z',
  },
  {
    id: 't-003',
    productId: 'p-011',
    productName: 'Nitrile Gloves (Box of 100)',
    warehouseId: 'wh-north',
    warehouseName: 'North Distribution Center',
    type: 'TRANSFER_OUT',
    quantity: 40,
    timestamp: '2026-09-17T11:20:00Z',
    linkedTransactionId: 't-004',
  },
  {
    id: 't-004',
    productId: 'p-012',
    productName: 'Nitrile Gloves (Box of 100)',
    warehouseId: 'wh-south',
    warehouseName: 'South Fulfillment Hub',
    type: 'TRANSFER_IN',
    quantity: 40,
    timestamp: '2026-09-17T11:20:00Z',
    linkedTransactionId: 't-003',
  },
]

export const transactions: Transaction[] =
  globalStore._stocklite_transactions ??
  (globalStore._stocklite_transactions = initialTransactions)

function getNextTransactionSeq(): number {
  if (typeof globalStore._stocklite_nextTxSeq !== 'number') {
    globalStore._stocklite_nextTxSeq = transactions.length + 1
  }
  return globalStore._stocklite_nextTxSeq++
}

function warehouseName(id: string) {
  return warehouses.find((w) => w.id === id)?.name ?? id
}

export function findProduct(id: string) {
  return products.find((p) => p.id === id)
}

export function recordTransaction(input: {
  productId: string
  productName: string
  warehouseId: string
  type: TransactionType
  quantity: number
  linkedTransactionId?: string
}): Transaction {
  const tx: Transaction = {
    id: `t-${String(getNextTransactionSeq()).padStart(3, '0')}`,
    productId: input.productId,
    productName: input.productName,
    warehouseId: input.warehouseId,
    warehouseName: warehouseName(input.warehouseId),
    type: input.type,
    quantity: input.quantity,
    timestamp: new Date().toISOString(),
    linkedTransactionId: input.linkedTransactionId,
  }
  transactions.push(tx)
  return tx
}

// -------------------------------------------------------------------------
// TASK 2 — Stock In / Stock Out
// -------------------------------------------------------------------------
// This is intentionally incomplete AND buggy. Right now it:
//   - does NOT validate the quantity (accepts 0, negative, or non-numeric)
//   - does NOT block a stock-out that exceeds current stock
//     (so currentStock can go NEGATIVE — this is one of the Task 5 bugs)
//   - does NOT call recordTransaction, so nothing shows up in History
//
// Participants must:
//   1. Validate quantity is a positive, finite number
//   2. Block OUT movements greater than currentStock
//   3. Apply the movement to the correct product
//   4. Call recordTransaction(...) so it appears in Transaction History
export function applyStockMovement(
  productId: string,
  quantity: number,
  direction: 'IN' | 'OUT',
  targetWarehouseId?: string,
): Product {
  let product = findProduct(productId)
  if (!product) throw new Error('Product not found')

  if (direction !== 'IN' && direction !== 'OUT') {
    throw new Error('Direction must be IN or OUT')
  }

  if (
    typeof quantity !== 'number' ||
    !Number.isFinite(quantity) ||
    Number.isNaN(quantity) ||
    quantity <= 0
  ) {
    throw new Error('Quantity must be a positive number greater than 0')
  }

  // If a target warehouse is provided and differs from the current product's warehouse
  if (targetWarehouseId && targetWarehouseId !== product.warehouseId) {
    const warehouse = warehouses.find((w) => w.id === targetWarehouseId)
    if (!warehouse) {
      throw new Error(`Warehouse '${targetWarehouseId}' does not exist`)
    }

    let targetProd = products.find(
      (p) =>
        p.warehouseId === targetWarehouseId &&
        p.name.toLowerCase() === product!.name.toLowerCase(),
    )

    if (!targetProd) {
      if (direction === 'OUT') {
        throw new Error(
          `Insufficient stock: ${product.name} does not exist at ${warehouse.name}`,
        )
      }
      let maxNum = 0
      for (const p of products) {
        const match = p.id.match(/^p-(\d+)$/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > maxNum) maxNum = num
        }
      }
      targetProd = {
        id: `p-${String(maxNum + 1).padStart(3, '0')}`,
        name: product.name,
        category: product.category,
        warehouseId: targetWarehouseId,
        currentStock: 0,
        reorderThreshold: product.reorderThreshold,
      }
      products.push(targetProd)
    }

    product = targetProd
  }

  if (direction === 'OUT' && quantity > product.currentStock) {
    throw new Error(
      `Insufficient stock: requested ${quantity}, but only ${product.currentStock} available in warehouse`,
    )
  }

  product.currentStock += direction === 'IN' ? quantity : -quantity

  recordTransaction({
    productId: product.id,
    productName: product.name,
    warehouseId: product.warehouseId,
    type: direction,
    quantity,
  })

  return product
}

export function applyTransfer(
  productId: string,
  destWarehouseId: string,
  quantity: number,
): { source: Product; destination: Product } {
  const source = findProduct(productId)
  if (!source) throw new Error('Source product not found')

  const sourceWarehouse = warehouses.find((w) => w.id === source.warehouseId)
  if (!sourceWarehouse) {
    throw new Error(`Source warehouse '${source.warehouseId}' does not exist`)
  }

  const destWarehouse = warehouses.find((w) => w.id === destWarehouseId)
  if (!destWarehouse) {
    throw new Error(`Destination warehouse '${destWarehouseId}' does not exist`)
  }

  if (source.warehouseId === destWarehouseId) {
    throw new Error('Source and destination warehouses must be different')
  }

  if (
    typeof quantity !== 'number' ||
    !Number.isFinite(quantity) ||
    Number.isNaN(quantity) ||
    quantity <= 0
  ) {
    throw new Error('Quantity must be a positive number greater than 0')
  }

  if (quantity > source.currentStock) {
    throw new Error(
      `Insufficient stock: requested transfer of ${quantity}, but only ${source.currentStock} available at source warehouse`,
    )
  }

  source.currentStock -= quantity

  let destination = products.find(
    (p) =>
      p.warehouseId === destWarehouseId &&
      p.name.toLowerCase() === source.name.toLowerCase(),
  )

  if (!destination) {
    let maxId = 0
    for (const p of products) {
      const match = p.id.match(/^p-(\d+)$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxId) maxId = num
      }
    }
    const newId = `p-${String(maxId + 1).padStart(3, '0')}`

    destination = {
      id: newId,
      name: source.name,
      category: source.category,
      warehouseId: destWarehouseId,
      currentStock: 0,
      reorderThreshold: source.reorderThreshold,
    }
    products.push(destination)
  }

  destination.currentStock += quantity

  const now = new Date().toISOString()
  const txOutId = `t-${String(getNextTransactionSeq()).padStart(3, '0')}`
  const txInId = `t-${String(getNextTransactionSeq()).padStart(3, '0')}`

  const txOut: Transaction = {
    id: txOutId,
    productId: source.id,
    productName: source.name,
    warehouseId: source.warehouseId,
    warehouseName: warehouseName(source.warehouseId),
    type: 'TRANSFER_OUT',
    quantity,
    timestamp: now,
    linkedTransactionId: txInId,
  }

  const txIn: Transaction = {
    id: txInId,
    productId: destination.id,
    productName: destination.name,
    warehouseId: destination.warehouseId,
    warehouseName: warehouseName(destination.warehouseId),
    type: 'TRANSFER_IN',
    quantity,
    timestamp: now,
    linkedTransactionId: txOutId,
  }

  transactions.push(txOut, txIn)

  return { source, destination }
}
