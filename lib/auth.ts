import { StaffUser } from './types'
import credentials from '../credentials.json'

type Credential = StaffUser & {
  staffId: string
  pin: string
}

const STAFF_CREDENTIALS = credentials as Credential[]

export function authenticateUser(staffId: string, pin: string): StaffUser | null {
  const match = STAFF_CREDENTIALS.find(
    (credential) => credential.staffId === staffId.trim() && credential.pin === pin,
  )

  if (!match) return null
  return { id: match.staffId, name: match.name, role: match.role }
}

// Server-side fallback for routes that need a staff identity in the demo.
export function getCurrentUser(): StaffUser {
  return { id: 'staff-user', name: 'Staff User', role: 'staff' }
}