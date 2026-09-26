import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET ?? 'stocklite-development-secret-change-me',
})

export const config = {
  matcher: [
    '/inventory/:path*',
    '/stock/:path*',
    '/transfer/:path*',
    '/history/:path*',
  ],
}