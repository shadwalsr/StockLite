import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'staff'
    } & DefaultSession['user']
  }

  interface User {
    role: 'staff'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: 'staff'
  }
}