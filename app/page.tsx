import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import {
  IconInventory,
  IconStock,
  IconTransfer,
  IconHistory,
} from '@/components/Sidebar'

const QUICK_LINKS = [
  {
    href: '/inventory',
    title: 'Inventory',
    description: 'Every SKU, every warehouse, with stock status at a glance.',
    icon: <IconInventory />,
  },
  {
    href: '/stock',
    title: 'Stock In / Out',
    description: 'Record incoming or outgoing stock for a single warehouse.',
    icon: <IconStock />,
  },
  {
    href: '/transfer',
    title: 'Transfer',
    description:
      'Move stock between warehouses without risking a partial write.',
    icon: <IconTransfer />,
  },
  {
    href: '/history',
    title: 'Transaction History',
    description: 'Every stock in, out, and transfer logged with a timestamp.',
    icon: <IconHistory />,
  },
]

export default function HomePage() {
  return (
    <>
      <nav className="marketing-nav">
        <span className="brand">StockLite</span>
        <div className="links">
          <Link href="/login">Sign in</Link>
          <ThemeToggle standalone />
        </div>
        <Link href="/inventory" className="btn btn-primary">
          Open dashboard
        </Link>
      </nav>

      <section className="hero-split">
        <div className="hero-copy">
          <h1>Warehouse stock, tracked the moment it moves.</h1>
          <p>
            StockLite gives your team one place to see inventory, move stock
            between warehouses, and catch reorder points before shelves run dry.
          </p>
          <div className="form-actions">
            <Link href="/inventory" className="btn btn-primary">
              View live inventory
            </Link>
            <Link href="/transfer" className="btn btn-secondary">
              Try a transfer
            </Link>
          </div>
        </div>

        <div className="hero-visual">
          <div className="floating-panel" style={{ marginTop: 40 }}>
            <h4>North Distribution Center</h4>
            <div className="big-stat">1,842 units</div>
            <p
              style={{
                fontSize: 12.5,
                color: 'var(--moss-dark)',
                margin: '4px 0 0',
              }}
            >
              +6.2% since last transfer
            </p>
          </div>
          <div className="floating-chip" style={{ top: '18%', left: '8%' }}>
            ⚠ 4 items near reorder threshold
          </div>
          <div
            className="floating-chip"
            style={{ bottom: '20%', right: '10%' }}
          >
            ✓ Transfer to South Hub completed
          </div>
        </div>
      </section>

      <section id="quick-links" className="quick-links-section">
        <h2>Jump into StockLite</h2>
        <div className="feature-grid">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="feature-card feature-card-link"
            >
              <span className="feature-card-icon">{link.icon}</span>
              <h3>{link.title}</h3>
              <p>{link.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
