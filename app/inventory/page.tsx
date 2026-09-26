import DashboardShell from '@/components/DashboardShell'
import InventoryTable from '@/components/InventoryTable'
import IntelligenceSuite from '@/components/IntelligenceSuite'
import { products, warehouses, transactions } from '@/lib/seed-data'

export const dynamic = 'force-dynamic'

export default function InventoryPage() {
  return (
    <DashboardShell>
      <div className="page-header">
        <div>
          <h1>Inventory</h1>
          <p>Current stock across both warehouses.</p>
        </div>
      </div>
      <IntelligenceSuite
        initialProducts={products}
        warehouses={warehouses}
        initialTransactions={transactions}
      />
      <InventoryTable products={products} warehouses={warehouses} />
    </DashboardShell>
  )
}
