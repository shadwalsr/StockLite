'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle({ standalone = false }: { standalone?: boolean }) {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('stocklite-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = saved ? saved === 'dark' : prefersDark
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    setDark(isDark)
  }, [])

  function toggleTheme() {
    const nextDark = !dark
    document.documentElement.dataset.theme = nextDark ? 'dark' : 'light'
    localStorage.setItem('stocklite-theme', nextDark ? 'dark' : 'light')
    setDark(nextDark)
  }

  return (
    <button
      type="button"
      className={`theme-toggle${standalone ? ' theme-toggle-standalone' : ''}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}
      title={`Switch to ${dark ? 'light' : 'dark'} theme`}
    >
      <span className="theme-icon" aria-hidden="true">
        {dark ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
          </svg>
        )}
      </span>
    </button>
  )
}