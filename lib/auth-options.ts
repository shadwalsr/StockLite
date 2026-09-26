import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import credentials from '../credentials.json'

const developmentSecret = 'stocklite-development-secret-change-me'
const sessionMaxAge = 30 * 24 * 60 * 60
const secureCookies = process.env.NODE_ENV === 'production'

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? developmentSecret,
  session: {
    strategy: 'jwt',
    maxAge: sessionMaxAge,
  },
  jwt: {
    maxAge: sessionMaxAge,
  },
  cookies: {
    sessionToken: {
      name: `${secureCookies ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: secureCookies,
        maxAge: sessionMaxAge,
      },
    },
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Staff credentials',
      credentials: {
        staffId: { label: 'Staff ID', type: 'text' },
        pin: { label: 'PIN', type: 'password' },
      },
      async authorize(input) {
        const staffId = input?.staffId?.trim()
        const pin = input?.pin?.trim()
        const match = credentials.find(
          (credential) => credential.staffId === staffId && credential.pin === pin,
        )

        if (!match) return null
        return { id: match.staffId, name: match.name, role: 'staff' as const }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as 'staff'
      }
      return session
    },
  },
}