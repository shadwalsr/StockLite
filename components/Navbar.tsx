'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useState } from 'react'
import ThemeToggle from '@/components/ThemeToggle'

export default function Navbar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [accountOpen, setAccountOpen] = useState(false)

  const userName = session?.user?.name ?? 'Staff User'

  const initials = userName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  async function handleLogout() {
    await signOut({ callbackUrl: '/', redirect: true })
  }

  async function handleSwitchAccount() {
    const returnTo = encodeURIComponent(pathname || '/inventory')
    await signOut({
      callbackUrl: `/login?returnTo=${returnTo}`,
      redirect: true,
    })
  }

  return (
    <header className="app-navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-brand">
          <span className="navbar-brand-mark">SL</span>
          <span>StockLite</span>
        </Link>

        <div className="navbar-actions">
          <ThemeToggle standalone />
          <div className="account-menu">
            <button
              type="button"
              className="navbar-account-trigger"
              onClick={() => setAccountOpen((open) => !open)}
              aria-expanded={accountOpen}
              aria-haspopup="dialog"
            >
              <span className="navbar-avatar">{initials}</span>
              <span className="navbar-user-name">{userName}</span>
            </button>
            {accountOpen && (
              <div className="account-modal" role="dialog" aria-label="Account options">
                <div className="account-modal-heading">
                  <span className="navbar-avatar">{initials}</span>
                  <div>
                    <strong>{userName}</strong>
                    <span>Staff account</span>
                  </div>
                </div>
                <button type="button" className="account-action" onClick={handleSwitchAccount}>
                  Switch account
                </button>
                <button type="button" className="account-action account-action-danger" onClick={handleLogout}>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
