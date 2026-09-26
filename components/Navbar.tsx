'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import ThemeToggle from '@/components/ThemeToggle'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userName, setUserName] = useState('Staff User')
  const [accountOpen, setAccountOpen] = useState(false)

  useEffect(() => {
    const savedUser = localStorage.getItem('stocklite-user')
    if (!savedUser) return

    try {
      const user = JSON.parse(savedUser) as { name?: string }
      if (user.name) setUserName(user.name)
    } catch {
      localStorage.removeItem('stocklite-user')
    }
  }, [])

  const initials = userName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  function handleLogout() {
    localStorage.removeItem('stocklite-user')
    setUserName('Staff User')
    setAccountOpen(false)
    router.push('/inventory')
  }

  function handleSwitchAccount() {
    const returnTo = encodeURIComponent(pathname || '/inventory')
    setAccountOpen(false)
    router.push(`/login?returnTo=${returnTo}`)
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
              <span className="account-chevron" aria-hidden="true">⌄</span>
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
