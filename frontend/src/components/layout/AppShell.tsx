import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { X, CheckCheck, AlertCircle, AlertTriangle, CheckCircle2, Info, BellOff } from 'lucide-react'
import { clsx } from 'clsx'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useWebSocket } from '@/hooks/useWebSocket'

interface NotificationItem {
  id: string
  type: 'error' | 'warning' | 'success' | 'info'
  title: string
  message: string
  timestamp: string
  read: boolean
}

// ─── Notification Panel Component ─────────────────────────────────────────────
interface NotificationPanelProps {
  notifications: NotificationItem[]
  onMarkAllRead: () => void
  onMarkRead: (id: string) => void
  onClearAll: () => void
  onClose: () => void
}

function NotificationPanel({
  notifications,
  onMarkAllRead,
  onMarkRead,
  onClearAll,
  onClose,
}: NotificationPanelProps) {
  return (
    <div className="h-full w-full flex flex-col bg-[#0F121C] border-l border-slate-800/80 overflow-hidden relative z-20">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between px-4 py-3.5 bg-slate-950/40 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-400" />
            <span className="absolute inset-0 h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping opacity-75" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-200 font-mono">SYSTEM LOGS & ALERTS</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Control Actions */}
      {notifications.length > 0 && (
        <div className="flex flex-shrink-0 items-center justify-between px-4 py-2 border-b border-slate-800/40 bg-slate-950/10">
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
          >
            <CheckCheck size={11} />
            Mark all read
          </button>
          <button
            onClick={onClearAll}
            className="text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-400 transition-colors cursor-pointer"
          >
            Clear logs
          </button>
        </div>
      )}

      {/* Scrollable list */}
      <div className="flex-grow overflow-y-auto p-3 space-y-2 custom-scrollbar min-h-0">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-slate-900 border border-slate-800 text-slate-600 mb-3 shadow-inner">
              <BellOff size={16} />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">ALL SYSTEMS NOMINAL</span>
            <span className="text-[10px] text-slate-600 max-w-[200px] mt-1.5 leading-normal">
              Go Ingestion Engine report is clear. No active alerts or warnings in log queue.
            </span>
          </div>
        ) : (
          notifications.map((item) => {
            const isUnread = !item.read
            return (
              <div
                key={item.id}
                onClick={() => onMarkRead(item.id)}
                className={clsx(
                  "p-3 rounded-lg border transition-all duration-150 cursor-pointer relative group",
                  isUnread
                    ? "border-slate-800 bg-slate-900/30 hover:bg-slate-900/50"
                    : "border-slate-900/40 bg-slate-950/10 opacity-60 hover:opacity-100"
                )}
              >
                {/* Unread pulsing dot */}
                {isUnread && (
                  <span className="absolute top-3.5 right-3.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.8)]" />
                )}

                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex-shrink-0">
                    {item.type === 'error' && <AlertCircle size={13} className="text-rose-400 drop-shadow-[0_0_3px_rgba(244,63,94,0.4)]" />}
                    {item.type === 'warning' && <AlertTriangle size={13} className="text-amber-400 drop-shadow-[0_0_3px_rgba(251,191,36,0.4)]" />}
                    {item.type === 'success' && <CheckCircle2 size={13} className="text-emerald-400 drop-shadow-[0_0_3px_rgba(52,211,153,0.4)]" />}
                    {item.type === 'info' && <Info size={13} className="text-indigo-400 drop-shadow-[0_0_3px_rgba(129,140,248,0.4)]" />}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-slate-200 leading-snug">
                      {item.title}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500 mt-0.5">
                      {item.timestamp}
                    </span>
                    <p className="text-[10px] text-slate-400 leading-normal font-mono mt-1.5 select-all">
                      {item.message}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Main AppShell Component ──────────────────────────────────────────────────
export default function AppShell() {
  const { status } = useWebSocket()
  const location = useLocation()
  const isPortainer = location.pathname.startsWith('/infra/portainer')

  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      type: 'error',
      title: 'Dukascopy Uplink Failure',
      message: 'Go Ingestion Daemon on node 192.168.1.8 lost connection to Dukascopy API. Reconnection attempt 1/5 in progress.',
      timestamp: '00:32 UTC',
      read: false,
    },
    {
      id: '2',
      type: 'success',
      title: 'EURUSD Daily Candle Aggregated',
      message: 'Processed 24 hourly tick Parquet files into Daily Candles. Physical validation complete, uploaded to Cloudflare R2.',
      timestamp: '00:25 UTC',
      read: false,
    },
    {
      id: '3',
      type: 'warning',
      title: 'High DB Latency Detected',
      message: 'PostgreSQL connection pool on direct port reports latency above threshold (320ms). Auto-adjusting pool size.',
      timestamp: '00:10 UTC',
      read: true,
    },
    {
      id: '4',
      type: 'info',
      title: 'Pruning Cycle Executed',
      message: 'Cleaned up 1,420 physical Parquet tick files from Cloudflare R2 staging path prior to historical start date.',
      timestamp: '23:55 UTC',
      read: true,
    },
  ])

  const hasUnread = notifications.some((n) => !n.read)

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleMarkRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const handleClearAll = () => {
    setNotifications([])
  }

  return (
    <div
      className="h-screen w-screen overflow-hidden"
      style={{
        display: 'grid',
        gridTemplateAreas: isPortainer 
          ? (showNotifications ? '"topbar topbar" "main notifications"' : '"topbar topbar" "main main"')
          : (showNotifications ? '"topbar topbar topbar" "sidebar main notifications"' : '"topbar topbar" "sidebar main"'),
        gridTemplateRows: '56px 1fr',
        gridTemplateColumns: isPortainer 
          ? (showNotifications ? '1fr 300px' : '1fr')
          : (showNotifications ? '240px 1fr 300px' : '240px 1fr'),
        background: '#0B0D13',
      }}
    >
      {/* Topbar */}
      <header style={{ gridArea: 'topbar', position: 'relative', zIndex: 50 }}>
        <Topbar
          wsStatus={status}
          onToggleNotifications={() => setShowNotifications((p) => !p)}
          hasUnreadNotifications={hasUnread}
        />
      </header>

      {/* Sidebar */}
      {!isPortainer && (
        <aside
          style={{ gridArea: 'sidebar' }}
          className="overflow-hidden border-r border-slate-800"
        >
          <Sidebar />
        </aside>
      )}

      {/* Main content — NO overflow here; each page manages its own */}
      <main
        style={{ gridArea: 'main' }}
        className="overflow-hidden"
      >
        <Outlet />
      </main>

      {/* Notification Drawer Side-panel */}
      {showNotifications && (
        <aside
          style={{ gridArea: 'notifications' }}
          className="overflow-hidden"
        >
          <NotificationPanel
            notifications={notifications}
            onMarkAllRead={handleMarkAllRead}
            onMarkRead={handleMarkRead}
            onClearAll={handleClearAll}
            onClose={() => setShowNotifications(false)}
          />
        </aside>
      )}
    </div>
  )
}
