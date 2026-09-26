'use client'

import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'


export default function DashboardShell({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-body">
        <Sidebar />
        <main className="main">
          <div className="page-fade">{children}</div>
        </main>
      </div>
    </div>
  )
}
