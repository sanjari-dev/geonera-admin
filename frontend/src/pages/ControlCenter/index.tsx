import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  GitMerge,
  RefreshCw,
  XCircle,
  Zap,
  Terminal,
  ActivitySquare
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { api } from '@/lib/api'
import type { ActionDef, ControlResult } from '@/types'
import { clsx } from 'clsx'

const ACTION_ICONS: Record<string, React.ElementType> = {
  'ticks/regular':    Zap,
  'ticks/backfill':   ArrowRight,
  'candles/regular':  RefreshCw,
  'candles/backfill': ChevronDown,
  'maintenance':      Database,
  'sync':             GitMerge,
}

// Deep, immersive color palette for Cockpit UI
const ACTION_STYLES: Record<string, { border: string, bg: string, icon: string, dot: string }> = {
  'ticks/regular': {
    border: 'border-purple-500/30 hover:border-purple-500/70 hover:shadow-[0_0_25px_rgba(168,85,247,0.2)]',
    bg: 'bg-gradient-to-br from-purple-500/5 to-[#0A0D14]',
    icon: 'text-purple-400 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.3)]',
    dot: 'bg-purple-500'
  },
  'ticks/backfill': {
    border: 'border-fuchsia-500/30 hover:border-fuchsia-500/70 hover:shadow-[0_0_25px_rgba(217,70,239,0.2)]',
    bg: 'bg-gradient-to-br from-fuchsia-500/5 to-[#0A0D14]',
    icon: 'text-fuchsia-400 bg-fuchsia-500/10 shadow-[0_0_15px_rgba(217,70,239,0.3)]',
    dot: 'bg-fuchsia-500'
  },
  'candles/regular': {
    border: 'border-red-500/30 hover:border-red-500/70 hover:shadow-[0_0_25px_rgba(239,68,68,0.2)]',
    bg: 'bg-gradient-to-br from-red-500/5 to-[#0A0D14]',
    icon: 'text-red-400 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.3)]',
    dot: 'bg-red-500'
  },
  'candles/backfill': {
    border: 'border-orange-500/30 hover:border-orange-500/70 hover:shadow-[0_0_25px_rgba(249,115,22,0.2)]',
    bg: 'bg-gradient-to-br from-orange-500/5 to-[#0A0D14]',
    icon: 'text-orange-400 bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.3)]',
    dot: 'bg-orange-500'
  },
  'maintenance': {
    border: 'border-amber-500/30 hover:border-amber-500/70 hover:shadow-[0_0_25px_rgba(245,158,11,0.2)]',
    bg: 'bg-gradient-to-br from-amber-500/5 to-[#0A0D14]',
    icon: 'text-amber-400 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.3)]',
    dot: 'bg-amber-500'
  },
  'sync': {
    border: 'border-teal-500/30 hover:border-teal-500/70 hover:shadow-[0_0_25px_rgba(20,184,166,0.2)]',
    bg: 'bg-gradient-to-br from-teal-500/5 to-[#0A0D14]',
    icon: 'text-teal-400 bg-teal-500/10 shadow-[0_0_15px_rgba(20,184,166,0.3)]',
    dot: 'bg-teal-500'
  },
}

function ActionCard({
  action,
  onTrigger,
  isLoading,
  index
}: {
  action: ActionDef
  onTrigger: () => void
  isLoading: boolean
  index: number
}) {
  const Icon = ACTION_ICONS[action.key] ?? Cpu
  const style = ACTION_STYLES[action.key] ?? ACTION_STYLES['sync']

  return (
    <button
      onClick={onTrigger}
      disabled={isLoading}
      className={clsx(
        'group relative w-full min-w-0 flex flex-col text-left overflow-hidden rounded-2xl border transition-all duration-500 ease-out',
        'hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:transform-none',
        style.border,
        style.bg
      )}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
    >
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative p-5 pb-4 w-full flex-1 flex flex-col">
        <div className="flex items-start justify-between w-full mb-4">
          <div className={clsx('flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-xl border border-white/10 transition-transform duration-300 group-hover:scale-110', style.icon)}>
            <Icon size={20} strokeWidth={2.2} className="relative z-10" />
          </div>
          {isLoading && (
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-900/50 backdrop-blur border border-slate-800">
              <RefreshCw size={14} className="text-slate-400 animate-spin" />
            </div>
          )}
        </div>
        
        <div className="w-full min-w-0 mt-auto">
          <h3 className="font-bold text-slate-100 text-sm tracking-wide truncate group-hover:text-white transition-colors">{action.label}</h3>
          <p className="mt-1.5 text-[11px] font-medium text-slate-500/90 leading-relaxed line-clamp-2">{action.description}</p>
        </div>
      </div>
      
      {/* Footer Path */}
      <div className="relative flex items-center gap-2 bg-slate-950/40 px-5 py-3 border-t border-white/5 w-full min-w-0 backdrop-blur-sm">
        <div className={clsx('h-1.5 w-1.5 rounded-full shadow-lg opacity-60 group-hover:opacity-100 transition-opacity', style.dot)} />
        <span className="font-mono text-[9px] uppercase tracking-widest text-slate-400 truncate block w-full group-hover:text-slate-300 transition-colors">
          {action.path}
        </span>
        <ArrowRight size={12} className="text-slate-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
      </div>
    </button>
  )
}

function EmptyLogState() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500">
      <div className="relative mb-6 group">
        <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-xl group-hover:bg-indigo-500/30 transition-colors duration-700" />
        <div className="absolute inset-0 animate-ping rounded-full border border-indigo-500/30" style={{ animationDuration: '3s' }} />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-[#0F121C] to-[#0A0C16] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_20px_rgba(99,102,241,0.15)]">
          <ActivitySquare size={32} className="text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.8)]" strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="mb-2 text-[13px] font-bold tracking-widest text-slate-200 uppercase font-mono">System Ready</h3>
      <p className="max-w-[220px] text-[11px] font-medium text-slate-500 leading-relaxed">
        Awaiting operational command. Trigger a daemon operation to monitor transaction logs in real-time.
      </p>
    </div>
  )
}

function ResultEntry({ result }: { result: ControlResult & { id: number } }) {
  const [expanded, setExpanded] = useState(false)
  const ts = new Date(result.timestamp).toISOString().slice(11, 19)

  return (
    <div
      className={clsx(
        'relative rounded-xl border p-3.5 transition-all duration-300 animate-in slide-in-from-right-4 fade-in',
        result.success
          ? 'border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-transparent shadow-[0_2px_10px_rgba(16,185,129,0.05)]'
          : 'border-red-500/20 bg-gradient-to-r from-red-500/10 to-transparent shadow-[0_2px_10px_rgba(239,68,68,0.05)]'
      )}
    >
      {/* Status glowing bar */}
      <div className={clsx(
        'absolute left-0 top-0 bottom-0 w-1 rounded-l-xl',
        result.success ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
      )} />

      <div className="flex items-center justify-between pl-1">
        <div className="flex items-center gap-3">
          {result.success
            ? <CheckCircle2 size={14} className="text-emerald-400" />
            : <XCircle size={14} className="text-red-400" />}
          <span className="font-semibold text-slate-200 tracking-wide text-xs">{result.action}</span>
          {result.httpStatus && (
            <span className={clsx('rounded px-1.5 py-0.5 font-mono text-[9px] font-bold border', result.success ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20')}>
              {result.httpStatus}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-slate-500 font-mono">
          <span className="text-[10px] tracking-wider">{ts}</span>
          {result.data !== undefined && result.data !== null && (
            <button 
              onClick={() => setExpanded((p) => !p)} 
              className="rounded-full p-1 bg-white/5 hover:bg-white/10 hover:text-slate-200 transition-colors border border-white/5"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
      </div>
      
      {result.error && (
        <div className="mt-2.5 pl-7 pr-2">
          <p className="text-[11px] font-medium text-red-400 break-words bg-red-500/5 p-2 rounded border border-red-500/10">
            {result.error}
          </p>
        </div>
      )}
      
      {expanded && result.data !== undefined && result.data !== null && (
        <div className="mt-3 pl-1 pr-1">
          <pre className="overflow-auto rounded-lg border border-slate-700/60 bg-[#05070A]/80 backdrop-blur p-3 text-[10px] font-mono text-slate-300 max-h-48 custom-scrollbar shadow-inner">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function ControlCenterPage() {
  const [log, setLog] = useState<Array<ControlResult & { id: number }>>([])
  const [counter, setCounter] = useState(0)
  const [pending, setPending] = useState<Record<string, boolean>>({})

  const { data: actions, isLoading, isError } = useQuery({
    queryKey: ['control', 'actions'],
    queryFn: api.control.actions,
    staleTime: Infinity,
  })

  const trigger = async (key: string) => {
    setPending((p) => ({ ...p, [key]: true }))
    try {
      const result = await api.control.trigger(key)
      setLog((prev) => [{ ...result, id: counter }, ...prev.slice(0, 49)])
      setCounter((c) => c + 1)
    } catch (err: any) {
      const fallback: ControlResult = {
        action: key,
        success: false,
        error: err.message ?? 'Request failed',
        timestamp: new Date().toISOString(),
      }
      setLog((prev) => [{ ...fallback, id: counter }, ...prev.slice(0, 49)])
      setCounter((c) => c + 1)
    } finally {
      setPending((p) => ({ ...p, [key]: false }))
    }
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-hidden p-5">
      {/* Premium HUD Warning Banner */}
      <div className="flex flex-shrink-0 items-center gap-4 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-[#0A0D14] px-5 py-4 shadow-[0_4px_20px_rgba(245,158,11,0.05)] relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 flex-shrink-0">
          <Cpu size={18} className="text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold tracking-wide text-amber-400 uppercase">Operational Console Live</p>
          <p className="mt-1 text-[11px] font-medium text-amber-500/70 leading-relaxed break-words">
            Asynchronous background processes trigger via Go Daemon proxy at{' '}
            <span className="font-mono text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 break-all shadow-inner">
              192.168.1.8:8080/api/v1
            </span>
            . Fire-and-forget architecture.
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-5">
        {/* Action grid Panel */}
        <div className="flex-1 min-w-0 flex flex-col bg-[#0B0F19] border border-slate-800/80 rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-30" />
          
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/40">
            <div>
              <h2 className="text-sm font-bold tracking-widest text-slate-100 uppercase">Daemon Trigger Matrix</h2>
              <p className="text-[10px] font-medium text-slate-500 mt-0.5">Control execution tasks on remote Fiber proxy</p>
            </div>
            <Terminal size={16} className="text-slate-600" />
          </div>

          <div className="flex-1 overflow-auto p-6 custom-scrollbar bg-[#0A0D14]/50">
            {isLoading && (
              <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-slate-800/50 bg-[#0F121C] p-5 h-40 animate-pulse flex flex-col justify-between">
                    <Skeleton className="h-10 w-10 rounded-xl bg-slate-800/50" />
                    <div className="space-y-2 mt-4">
                      <Skeleton className="h-4 w-3/4 bg-slate-800/50" />
                      <Skeleton className="h-3 w-1/2 bg-slate-800/50" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {actions && (
              <div
                className="grid content-start gap-5 pb-4"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
              >
                {actions.map((action, idx) => (
                  <ActionCard
                    key={action.key}
                    action={action}
                    onTrigger={() => trigger(action.key)}
                    isLoading={pending[action.key] ?? false}
                    index={idx}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Response log Panel */}
        <div className="w-[420px] flex-shrink-0 flex flex-col bg-[#0B0F19] border border-slate-800/80 rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 opacity-20" />
          
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-950/40">
            <div>
              <h2 className="text-sm font-bold tracking-widest text-slate-100 uppercase">Response Outbox</h2>
              <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                {log.length === 0 ? 'Awaiting tasks' : `${log.length} transaction entries`}
              </p>
            </div>
            <div className="flex items-center justify-center h-6 w-6 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <span className="font-mono text-[10px] font-bold">{log.length}</span>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-gradient-to-b from-[#0A0D14]/80 to-[#0A0D14]">
            {log.length === 0 ? (
              <EmptyLogState />
            ) : (
              <div className="space-y-3">
                {log.map((r) => <ResultEntry key={r.id} result={r} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
