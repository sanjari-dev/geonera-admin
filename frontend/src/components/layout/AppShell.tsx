import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useState } from 'react'

export default function AppShell() {
  const { status } = useWebSocket()
  const [showNotifications, setShowNotifications] = useState(false)
  const [hasUnread] = useState(false)

  return (
    <div
      className="geonera-page h-screen w-screen overflow-hidden"
      style={{
        display: 'grid',
        gridTemplateAreas: '"topbar topbar" "sidebar main"',
        gridTemplateRows: '56px 1fr',
        gridTemplateColumns: '240px 1fr',
      }}
    >
      <header style={{ gridArea: 'topbar' }}>
        <Topbar
          wsStatus={status}
          onToggleNotifications={() => setShowNotifications((p) => !p)}
          hasUnreadNotifications={hasUnread}
        />
      </header>

      <aside
        style={{ gridArea: 'sidebar' }}
        className="overflow-hidden border-r border-sky-200/60 dark:border-sky-900/30"
      >
        <Sidebar />
      </aside>

      <main style={{ gridArea: 'main' }} className="overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
