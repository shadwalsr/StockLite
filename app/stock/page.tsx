import DashboardShell from '@/components/DashboardShell'
import StockForm from '@/components/StockForm'
import { products, warehouses } from '@/lib/seed-data'

export const dynamic = 'force-dynamic'

export default function StockPage() {
  return (
    <DashboardShell>
      <div className="page-header">
        <div>
          <h1>Stock In / Stock Out & Purchasing</h1>
          <p>
            Manage item inventory: purchase stock for any warehouse or adjust stock levels per item card.
          </p>
        </div>
      </div>
      <StockForm products={products} warehouses={warehouses} />
    </DashboardShell>
  )
}
