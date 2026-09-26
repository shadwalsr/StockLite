'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle({ standalone = false }: { standalone?: boolean }) {
  const [dark, setDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('stocklite-theme')
    const currentDomTheme = document.documentElement.getAttribute('data-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = saved ? saved === 'dark' : (currentDomTheme === 'dark' || prefersDark)

    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', isDark)
    setDark(isDark)

    const handleThemeChange = () => {
      const current = document.documentElement.getAttribute('data-theme') === 'dark'
      setDark(current)
    }

    window.addEventListener('stocklite-theme-change', handleThemeChange)
    window.addEventListener('storage', handleThemeChange)
    return () => {
      window.removeEventListener('stocklite-theme-change', handleThemeChange)
      window.removeEventListener('storage', handleThemeChange)
    }
  }, [])

  function toggleTheme(e?: React.MouseEvent) {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const currentTheme = document.documentElement.getAttribute('data-theme') || (dark ? 'dark' : 'light')
    const nextDark = currentTheme !== 'dark'
    const nextTheme = nextDark ? 'dark' : 'light'

    document.documentElement.setAttribute('data-theme', nextTheme)
    document.documentElement.dataset.theme = nextTheme
    document.documentElement.classList.toggle('dark', nextDark)
    try {
      localStorage.setItem('stocklite-theme', nextTheme)
    } catch {}
    setDark(nextDark)
    window.dispatchEvent(new CustomEvent('stocklite-theme-change', { detail: { theme: nextTheme } }))
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