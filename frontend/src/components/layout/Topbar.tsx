import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { Database, Wifi, WifiOff, Clock, Maximize, Minimize, LayoutGrid, ChevronDown, Activity, Box, Bell, Layers } from 'lucide-react'
import type { WsStatus } from '@/hooks/useWebSocket'
import { api } from '@/lib/api'
import { clsx } from 'clsx'

const CONNECTED_APPS = [
  {
    name: 'Geonera Cockpit',
    route: '/dashboard',
    icon: Activity,
    description: 'Main ETL Ingestion Engine',
    external: false,
  },
  {
    name: 'Portainer Infra',
    route: 'https://192.168.1.8:9443/',
    icon: Box,
    description: 'Docker Container Management',
    external: true,
  },
  {
    name: 'RabbitMQ Console',
    route: 'http://192.168.1.8:15672/rabbitmq/',
    icon: Layers,
    description: 'Message Broker Management',
    external: true,
  },
]

interface TopbarProps {
  wsStatus: WsStatus
  onToggleNotifications: () => void
  hasUnreadNotifications: boolean
}

export default function Topbar({ wsStatus, onToggleNotifications, hasUnreadNotifications }: TopbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [time, setTime] = useState<Date>(new Date())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const { data: health } = useQuery({
    queryKey: ['dashboard', 'health'],
    queryFn: api.dashboard.health,
    refetchInterval: 10_000,
  })

  const dbConnected = health?.database === 'connected'
  const wsConnected = wsStatus === 'connected'

  const utcTimeString = time.toISOString().substring(11, 19)
  const utcDateString = time.toISOString().substring(0, 10)

  const activeApp = CONNECTED_APPS.find(app => 
    !app.external && (app.route === '/dashboard'
      ? location.pathname === '/' || location.pathname === '/dashboard'
      : location.pathname.startsWith(app.route))
  ) || CONNECTED_APPS[0]

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
    } else {
      document.exitFullscreen()
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-between border-b border-slate-800/60 bg-[#0A0D14]/95 backdrop-blur-md px-6 shadow-sm relative z-10">
      {/* Left - App Switcher Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-[#0F121D] hover:bg-slate-900/80 hover:border-slate-700/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-all duration-200 relative group text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <LayoutGrid size={13} className="text-indigo-400 drop-shadow-[0_0_3px_rgba(129,140,248,0.5)] group-hover:scale-105 transition-transform" />
            <span className="text-[11px] font-bold tracking-wide text-slate-200 uppercase">
              {activeApp.name}
            </span>
          </div>
          <ChevronDown size={12} className={clsx("text-slate-500 transition-transform duration-200", isOpen && "rotate-180")} />
        </button>

        {/* Dropdown Panel */}
        {isOpen && (
          <>
            {/* Click-outside backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            
            <div className="absolute left-0 mt-2 w-64 rounded-xl border border-slate-700/50 bg-[#0F121D]/95 backdrop-blur-md shadow-2xl p-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-1.5 border-b border-slate-800/80 mb-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 font-mono">Connected Applications</span>
              </div>
              <div className="space-y-1">
                {CONNECTED_APPS.map((app) => {
                  const AppIcon = app.icon
                  const isSelected = activeApp.name === app.name
                  return (
                    <button
                      key={app.name}
                      onClick={() => {
                        if (app.external) {
                          window.location.href = app.route
                        } else {
                          navigate(app.route)
                        }
                        setIsOpen(false)
                      }}
                      className={clsx(
                        "w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-all duration-150 group cursor-pointer",
                        isSelected
                          ? "bg-indigo-600/10 border border-indigo-500/20 text-indigo-300"
                          : "border border-transparent hover:bg-slate-900/60 hover:border-slate-800 text-slate-400 hover:text-slate-200"
                      )}
                    >
                      <div className={clsx(
                        "flex items-center justify-center h-7 w-7 rounded-md border flex-shrink-0 mt-0.5",
                        isSelected
                          ? "bg-indigo-500/10 border-indigo-500/25 text-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.2)]"
                          : "bg-slate-950 border-slate-800 text-slate-500 group-hover:text-slate-300"
                      )}>
                        <AppIcon size={13} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold leading-tight">{app.name}</span>
                        <span className="text-[10px] text-slate-500 leading-snug truncate mt-0.5">{app.description}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Center - Real-time UTC Cockpit Clock */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 px-4 py-1.5 rounded-lg border border-slate-800/50 bg-[#070A0F] shadow-[inset_0_1px_1px_rgba(255,255,255,0.02),0_4px_12px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-2">
          <Clock size={12} className="text-indigo-400 animate-pulse drop-shadow-[0_0_4px_rgba(129,140,248,0.6)]" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 font-mono">SYS_TIME</span>
        </div>
        <div className="h-3 w-px bg-slate-800" />
        <div className="flex items-center gap-2 font-mono">
          <span className="text-xs font-semibold text-slate-400 tabular-nums select-all tracking-wider">
            {utcDateString}
          </span>
          <span className="text-[10px] font-bold text-slate-600">UTC</span>
          <span className="text-sm font-bold text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)] tabular-nums select-all tracking-widest">
            {utcTimeString}
          </span>
        </div>
      </div>

      {/* Right — Cockpit HUD Indicators */}
      <div className="flex items-center gap-6">
        {/* WebSocket */}
        <div className="flex items-center gap-2 group cursor-default">
          <div className="relative flex items-center justify-center h-6 w-6 rounded bg-slate-900 border border-slate-800 shadow-inner">
            {wsConnected ? (
              <Wifi size={12} className="text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
            ) : (
              <WifiOff size={12} className="text-red-400 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
            )}
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 leading-none mb-0.5">Stream</span>
            <span
              className={clsx(
                'text-[10px] font-mono font-semibold uppercase tracking-wider leading-none transition-colors',
                wsConnected ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {wsStatus === 'connecting' ? 'CONNECTING...' : wsConnected ? 'ACTIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-800/60" />

        {/* Database */}
        <div className="flex items-center gap-2 group cursor-default">
          <div className="relative flex items-center justify-center h-6 w-6 rounded bg-slate-900 border border-slate-800 shadow-inner">
            <Database size={12} className={clsx(dbConnected ? 'text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]' : 'text-red-400 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]')} />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 leading-none mb-0.5">Database</span>
            <span
              className={clsx(
                'text-[10px] font-mono font-semibold uppercase tracking-wider leading-none transition-colors',
                dbConnected ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {health === undefined ? 'POLLING...' : dbConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-800/60" />

        {/* Notification Button */}
        <button
          onClick={onToggleNotifications}
          className="interactive-element flex items-center justify-center h-8 w-8 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 text-slate-400 hover:text-indigo-400 hover:bg-slate-900/90 shadow-inner transition-all duration-150 relative group cursor-pointer"
          title="System Logs & Alerts"
        >
          <Bell size={13} className="group-hover:scale-105 transition-transform" />
          {hasUnreadNotifications && (
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)] animate-pulse" />
          )}
        </button>

        <div className="h-6 w-px bg-slate-800/60" />

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="interactive-element flex items-center justify-center h-8 w-8 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 text-slate-400 hover:text-indigo-400 hover:bg-slate-900/90 shadow-inner transition-all duration-150 relative group"
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize size={13} className="drop-shadow-[0_0_3px_rgba(129,140,248,0.4)] text-indigo-400" />
          ) : (
            <Maximize size={13} className="group-hover:scale-105 transition-transform" />
          )}
        </button>
      </div>
    </div>
  )
}
