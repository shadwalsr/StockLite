'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import ThemeToggle from '@/components/ThemeToggle'

export default function LoginPage() {
  const router = useRouter()
  const [staffId, setStaffId] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [returnTo, setReturnTo] = useState('/')

  useEffect(() => {
    const requestedPath = new URLSearchParams(window.location.search).get('returnTo')
    if (requestedPath?.startsWith('/') && !requestedPath.startsWith('//')) {
      setReturnTo(requestedPath)
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanId = staffId.trim()

    if (!cleanId || pin.trim().length < 4) {
      setError('Enter a staff ID and a 4-digit PIN.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: cleanId, pin: pin.trim() }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? 'Could not sign you in.')
        return
      }
      localStorage.setItem('stocklite-user', JSON.stringify(data.user))
      router.push(returnTo)
    } catch {
      setError('Could not reach the sign-in service. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="panel login-card">
        <ThemeToggle standalone />
        <Link
          href={returnTo}
          className="back-link"
          style={{ display: 'inline-block', marginBottom: 18 }}
        >
          <span aria-hidden="true">←</span> Back to {returnTo === '/' ? 'home' : 'dashboard'}
        </Link>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>StockLite</h1>
        <p className="login-intro">
          Sign in to manage inventory, stock movements, and warehouse transfers.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
          <label htmlFor="staff-id">Staff ID</label>
          <input
            id="staff-id"
            type="text"
            placeholder="e.g. staff-01"
            value={staffId}
            onChange={(event) => setStaffId(event.target.value)}
          />
          </div>

          <div className="form-field">
            <label htmlFor="pin">PIN</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              maxLength={8}
              placeholder="4-digit PIN"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
          </div>

          <div className="form-error">{error}</div>
          <button type="submit" className="btn btn-primary login-submit" disabled={submitting}>
            {submitting ? 'Checking credentials...' : 'Continue to dashboard'}
          </button>
        </form>
        <p className="login-note">Demo credentials are stored in credentials.json.</p>
      </div>
    </div>
  )
}
