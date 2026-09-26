'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function IconInventory() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 9h18M9 4v16" />
    </svg>
  )
}

export function IconStock() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v18M6 8l6-5 6 5M6 16l6 5 6-5" />
    </svg>
  )
}

export function IconTransfer() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 8h13M13 4l4 4-4 4M20 16H7M11 12l-4 4 4 4" />
    </svg>
  )
}

export function IconHistory() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  )
}

const NAV_ITEMS = [
  { href: '/inventory', label: 'Inventory', icon: <IconInventory /> },
  { href: '/stock', label: 'Stock In / Out', icon: <IconStock /> },
  { href: '/transfer', label: 'Transfer', icon: <IconTransfer /> },
  { href: '/history', label: 'History', icon: <IconHistory /> },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">SL</div>
        <div className="sidebar-brand-text">
          StockLite
          <span>Warehouse Inventory</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

    </aside>
  )
}
