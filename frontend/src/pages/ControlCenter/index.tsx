/**
 * Control Center — Unified trigger hub for the Go ingestion daemon.
 *
 * Two modes, same workers:
 *  • Manual Triggers  — ad-hoc REST POST directly to the Go Daemon
 *  • Scheduled Jobs   — in-process croner fires → RabbitMQ → Go consumer
 *
 * A single Activity Log on the right aggregates results from both modes.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  Database,
  GitMerge,
  Globe,
  Pause,
  Play,
  Plus,
  Rabbit,
  RefreshCw,
  Send,
  Trash2,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { api } from '@/lib/api'
import type { ActionDef, ControlResult, Cron, CronStatus, CronTriggerMethod } from '@/types'
import { clsx } from 'clsx'

// ─── Shared types ────────────────────────────────────────────────────────────

type Tab = 'manual' | 'scheduled'

interface LogEntry {
  id: number
  label: string
  mode: 'REST' | 'MQ'
  success: boolean
  ts: string
  detail?: string
}

// ─── Shared: activity log entry ──────────────────────────────────────────────

function LogItem({ entry }: { entry: LogEntry }) {
  return (
    <div
      className={clsx(
        'relative rounded-xl border px-3 py-2.5 text-xs transition-all',
        entry.success
          ? 'border-emerald-500/15 bg-emerald-500/5'
          : 'border-red-500/15 bg-red-500/5'
      )}
    >
      <div className={clsx(
        'absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl',
        entry.success ? 'bg-emerald-500' : 'bg-red-500'
      )} />
      <div className="flex items-center justify-between pl-1">
        <div className="flex items-center gap-2 min-w-0">
          {entry.success
            ? <CheckCircle2 size={12} className="flex-shrink-0 text-emerald-400" />
            : <XCircle size={12} className="flex-shrink-0 text-red-400" />}
          <span className="font-mono text-slate-800 dark:text-sky-100 truncate">{entry.label}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <span className={clsx(
            'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
            entry.mode === 'REST'
              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
          )}>
            {entry.mode === 'REST' ? <Globe size={8} className="inline mr-0.5" /> : <Rabbit size={8} className="inline mr-0.5" />}
            {entry.mode}
          </span>
          <span className="font-mono text-[10px] text-slate-600">{entry.ts}</span>
        </div>
      </div>
      {entry.detail && (
        <p className="mt-0.5 pl-1 font-mono text-[10px] text-slate-600 truncate">{entry.detail}</p>
      )}
    </div>
  )
}

// ─── Tab 1: Manual Triggers ──────────────────────────────────────────────────

const ACTION_ICONS: Record<string, React.ElementType> = {
  'ticks/regular':    Zap,
  'ticks/backfill':   ArrowRight,
  'candles/regular':  RefreshCw,
  'candles/backfill': ChevronDown,
  'maintenance':      Database,
  'sync':             GitMerge,
}

type ActionStyle = {
  border: string; bg: string; icon: string; dot: string
  wave: string; chip: string; glow: string
}

// All 6 cards use variations of the sky-blue spectrum (biru langit theme)
const ACTION_STYLES: Record<string, ActionStyle> = {
  'ticks/regular': {
    border: 'border-sky-400 dark:border-sky-500/40/35 hover:border-sky-400 dark:border-sky-500/40/75 hover:shadow-[0_0_28px_rgba(14,165,233,0.2)]',
    bg: 'bg-gradient-to-br from-sky-500/8 to-[#030C18]',
    icon: 'text-sky-700 dark:text-sky-300 bg-sky-500/12',
    dot: 'bg-sky-400', wave: 'bg-sky-400',
    chip: 'border-sky-400 dark:border-sky-500/40/20 bg-sky-500/[0.08] text-sky-700 dark:text-sky-300/85',
    glow: 'bg-sky-500',
  },
  'ticks/backfill': {
    border: 'border-cyan-400/35 hover:border-cyan-400/75 hover:shadow-[0_0_28px_rgba(34,211,238,0.2)]',
    bg: 'bg-gradient-to-br from-cyan-500/8 to-[#030C18]',
    icon: 'text-cyan-300 bg-cyan-500/12',
    dot: 'bg-cyan-400', wave: 'bg-cyan-400',
    chip: 'border-cyan-400/20 bg-cyan-500/[0.08] text-cyan-300/85',
    glow: 'bg-cyan-500',
  },
  'candles/regular': {
    border: 'border-blue-400/35 hover:border-blue-400/75 hover:shadow-[0_0_28px_rgba(96,165,250,0.2)]',
    bg: 'bg-gradient-to-br from-blue-500/8 to-[#030C18]',
    icon: 'text-blue-300 bg-blue-500/12',
    dot: 'bg-blue-400', wave: 'bg-blue-400',
    chip: 'border-blue-400/20 bg-blue-500/[0.08] text-blue-300/85',
    glow: 'bg-blue-500',
  },
  'candles/backfill': {
    border: 'border-sky-500/35 hover:border-sky-500/75 hover:shadow-[0_0_28px_rgba(14,165,233,0.2)]',
    bg: 'bg-gradient-to-br from-sky-600/8 to-[#030C18]',
    icon: 'text-sky-200 bg-sky-600/12',
    dot: 'bg-sky-500', wave: 'bg-sky-300',
    chip: 'border-sky-500/20 bg-sky-600/[0.08] text-sky-200/85',
    glow: 'bg-sky-600',
  },
  'maintenance': {
    border: 'border-indigo-400/35 hover:border-indigo-400/75 hover:shadow-[0_0_28px_rgba(129,140,248,0.2)]',
    bg: 'bg-gradient-to-br from-indigo-500/8 to-[#030C18]',
    icon: 'text-sky-700 dark:text-sky-300 bg-indigo-500/12',
    dot: 'bg-indigo-400', wave: 'bg-indigo-400',
    chip: 'border-indigo-400/20 bg-indigo-500/[0.08] text-sky-700 dark:text-sky-300/85',
    glow: 'bg-indigo-500',
  },
  'sync': {
    border: 'border-teal-400/35 hover:border-teal-400/75 hover:shadow-[0_0_28px_rgba(45,212,191,0.2)]',
    bg: 'bg-gradient-to-br from-teal-500/8 to-[#030C18]',
    icon: 'text-teal-300 bg-teal-500/12',
    dot: 'bg-teal-400', wave: 'bg-teal-400',
    chip: 'border-teal-400/20 bg-teal-500/[0.08] text-teal-300/85',
    glow: 'bg-teal-500',
  },
}

// Metadata per worker — sourced from architecture doc (Arsitektur Ingestion.md)
const ACTION_META: Record<string, { frequency: string; mode: string; lock: string }> = {
  'ticks/regular':    { frequency: 'Hourly :02',   mode: 'T-0 · T-1 · T-2',  lock: 'Lock #1001' },
  'ticks/backfill':   { frequency: 'Every 10 min', mode: 'FAILED → Retry',    lock: 'Lock #1001' },
  'candles/regular':  { frequency: 'Daily 05:08',  mode: '19 Timeframes',     lock: 'Lock #1002' },
  'candles/backfill': { frequency: 'Every 20 min', mode: 'OHLCV Sweeper',     lock: 'Lock #1002' },
  'maintenance':      { frequency: 'Every 5 min',  mode: 'Seeder + Pruner',   lock: 'Lock #1003' },
  'sync':             { frequency: 'Every 5 min',  mode: 'Outbox Pattern',    lock: 'Lock #1004' },
}

// Natural-looking signal wave heights (14 bars)
const WAVE_H = [42, 68, 84, 52, 92, 38, 76, 88, 54, 72, 62, 86, 46, 70]

function WaveformBars({ waveClass }: { waveClass: string }) {
  return (
    <div className="flex items-end gap-[3px] h-10 px-0.5">
      {WAVE_H.map((h, i) => (
        <div
          key={i}
          className={clsx('w-[5px] rounded-full origin-bottom', waveClass)}
          style={{
            height: `${h}%`,
            animation: 'waveBar 1.8s ease-in-out infinite',
            animationDelay: `${i * 0.09}s`,
          }}
        />
      ))}
    </div>
  )
}

function ActionCard({
  action, isLoading, onTrigger, cron,
}: {
  action: ActionDef
  isLoading: boolean
  onTrigger: () => void
  cron?: import('@/types').Cron | null
}) {
  const Icon = ACTION_ICONS[action.key] ?? Cpu
  const s = ACTION_STYLES[action.key] ?? ACTION_STYLES['sync']
  const meta = ACTION_META[action.key]

  const nextRun = cron?.nextRunAt
    ? new Date(cron.nextRunAt).toISOString().slice(11, 16) + ' UTC'
    : null
  const isScheduled = cron?.status === 'ACTIVE'

  return (
    <button
      onClick={onTrigger}
      disabled={isLoading}
      className={clsx(
        'group relative flex h-full flex-col text-left overflow-hidden rounded-2xl border transition-all duration-500',
        'hover:-translate-y-0.5 hover:scale-[1.005] active:scale-[0.995]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:transform-none',
        s.border, s.bg
      )}
    >
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-white dark:bg-[#071628]/[0.015] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="relative flex flex-1 flex-col p-5 gap-4">

        {/* Row 1: Icon + spinner */}
        <div className="flex items-start justify-between">
          <div className="relative">
            {/* Ambient glow behind icon */}
            <div className={clsx('absolute -inset-2 rounded-full blur-xl opacity-25 transition-opacity duration-500 group-hover:opacity-50', s.glow)} />
            <div className={clsx('relative flex items-center justify-center h-12 w-12 rounded-xl border border-white/10 transition-transform duration-300 group-hover:scale-110 shadow-lg', s.icon)}>
              <Icon size={22} strokeWidth={2.2} />
            </div>
          </div>
          {isLoading
            ? <RefreshCw size={14} className="text-slate-400 dark:text-slate-500 animate-spin" />
            : isScheduled
              ? <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest text-emerald-400/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
                  Scheduled
                </span>
              : null}
        </div>

        {/* Row 2: Metadata chips */}
        {meta && (
          <div className="flex flex-wrap gap-1.5">
            {[meta.frequency, meta.mode, meta.lock].map((label) => (
              <span
                key={label}
                className={clsx(
                  'rounded border px-2 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap',
                  s.chip
                )}
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Row 3: Animated waveform signal */}
        <div className="rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2">
          <WaveformBars waveClass={s.wave} />
        </div>

        {/* Row 4: Cron schedule line */}
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5">
            <Clock size={9} className="text-slate-600" />
            <code className="font-mono text-slate-600">{cron?.cronExpr ?? '—'}</code>
          </div>
          {nextRun && (
            <span className="font-mono text-slate-600 tabular-nums">
              ⏭ {nextRun}
            </span>
          )}
        </div>

        {/* Row 5: Title + description — pinned to bottom of body */}
        <div className="mt-auto">
          <p className="font-bold text-slate-100 text-[15px] tracking-wide">{action.label}</p>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed line-clamp-1">{action.description}</p>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="relative flex-shrink-0 flex items-center gap-2 bg-[#040E1C]/50 px-5 py-2.5 border-t border-white/[0.05] backdrop-blur-sm">
        <div className={clsx('h-1.5 w-1.5 rounded-full opacity-50 group-hover:opacity-100 transition-opacity', s.dot)} />
        <span className="font-mono text-[9px] uppercase tracking-widest text-slate-600 group-hover:text-slate-400 dark:text-slate-500 transition-colors truncate">
          POST /api/v1{action.path}
        </span>
      </div>
    </button>
  )
}

function ManualTriggersTab({
  onLog,
}: { onLog: (entry: Omit<LogEntry, 'id'>) => void }) {
  const [pending, setPending] = useState<Record<string, boolean>>({})

  const { data: actions, isLoading, isError } = useQuery({
    queryKey: ['control', 'actions'],
    queryFn: api.control.actions,
    staleTime: Infinity,
  })

  // Cross-reference cron schedules by workerKey to show live schedule data on each card
  const { data: crons } = useQuery({
    queryKey: ['crons'],
    queryFn: api.crons.list,
    refetchInterval: 30_000,
  })
  const getCron = (key: string) => crons?.find((c) => c.workerKey === key) ?? null

  const trigger = async (action: ActionDef) => {
    setPending((p) => ({ ...p, [action.key]: true }))
    try {
      const result = await api.control.trigger(action.key) as ControlResult
      onLog({
        label: action.label,
        mode: 'REST',
        success: result.success ?? true,
        ts: new Date().toISOString().slice(11, 19),
        detail: `HTTP ${result.httpStatus ?? 202} · /api/v1${action.path}`,
      })
    } catch (err: any) {
      onLog({
        label: action.label,
        mode: 'REST',
        success: false,
        ts: new Date().toISOString().slice(11, 19),
        detail: err.message ?? 'Daemon unreachable',
      })
    } finally {
      setPending((p) => ({ ...p, [action.key]: false }))
    }
  }

  if (isLoading) return (
    <div className="flex h-full items-center justify-center">
      <RefreshCw size={20} className="animate-spin text-slate-600" />
    </div>
  )
  if (isError) return (
    <div className="flex h-full items-center justify-center text-sm text-red-400">
      Could not load actions — is the backend running?
    </div>
  )

  return (
    <div
      className="grid h-full gap-3"
      style={{
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
      }}
    >
      {actions?.map((action) => (
        <ActionCard
          key={action.key}
          action={action}
          cron={getCron(action.key)}
          isLoading={pending[action.key] ?? false}
          onTrigger={() => trigger(action)}
        />
      ))}
    </div>
  )
}

// ─── Tab 2: Scheduled Jobs ────────────────────────────────────────────────────

const STATUS_STYLES: Record<CronStatus, string> = {
  ACTIVE:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  PAUSED:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  INACTIVE: 'bg-slate-700/40 text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-700',
}
const STATUS_DOT: Record<CronStatus, string> = {
  ACTIVE:   'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse',
  PAUSED:   'bg-amber-400',
  INACTIVE: 'bg-slate-600',
}

function CronStatusBadge({ status }: { status: CronStatus }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide', STATUS_STYLES[status])}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
      {status}
    </span>
  )
}

function CronRow({
  cron, onToggle, onTrigger, onDelete, isToggling, isTriggering, isDeleting,
}: {
  cron: Cron
  onToggle: () => void; onTrigger: () => void; onDelete: () => void
  isToggling: boolean; isTriggering: boolean; isDeleting: boolean
}) {
  const [showResult, setShowResult] = useState(false)
  const lastResult = cron.lastResult as Record<string, unknown> | null
  const resultSuccess = lastResult?.success as boolean | undefined

  return (
    <tr className="group border-b border-slate-200 dark:border-sky-900/30 shadow-sm/60 transition-colors hover:bg-sky-900/30/20">
      <td className="px-4 py-3"><CronStatusBadge status={cron.status as CronStatus} /></td>
      <td className="px-4 py-3">
        <div className="font-mono text-sm font-semibold text-slate-800 dark:text-sky-100">{cron.name}</div>
        {cron.description && <div className="mt-0.5 max-w-[200px] text-[11px] leading-snug text-slate-400 dark:text-slate-500">{cron.description}</div>}
      </td>
      <td className="px-4 py-3">
        <code className="rounded border border-slate-200 dark:border-sky-900/30 shadow-sm bg-white dark:bg-[#071628] px-2 py-1 text-[11px] font-mono text-sky-700 dark:text-sky-300">{cron.cronExpr}</code>
      </td>
      <td className="px-4 py-3">
        {cron.nextRunAt ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <Clock size={11} className="text-slate-600" />
            <span className="font-mono">{new Date(cron.nextRunAt).toISOString().slice(11, 19)}</span>
            <span className="text-[10px] text-slate-600">UTC</span>
          </div>
        ) : <span className="text-xs text-slate-600">—</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-purple-400">
            <Rabbit size={8} />MQ
          </span>
          <code className="max-w-[130px] truncate text-[10px] font-mono text-slate-400 dark:text-slate-500">{cron.queueName ?? cron.httpPath ?? '—'}</code>
        </div>
      </td>
      <td className="px-4 py-3">
        {cron.lastTriggeredAt ? (
          <div>
            <div className="flex items-center gap-2">
              {resultSuccess === true ? <CheckCircle2 size={12} className="text-emerald-400" /> : resultSuccess === false ? <XCircle size={12} className="text-red-400" /> : null}
              <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{new Date(cron.lastTriggeredAt).toISOString().slice(0, 19).replace('T', ' ')}</span>
              {lastResult && (
                <button onClick={() => setShowResult((p) => !p)} className="rounded p-0.5 text-slate-600 hover:bg-sky-900/30 hover:text-slate-400 dark:text-slate-500">
                  {showResult ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
              )}
            </div>
            {showResult && lastResult && (
              <pre className="mt-1.5 max-h-20 overflow-auto rounded border border-slate-200 dark:border-sky-900/30 shadow-sm bg-white dark:bg-[#071628] p-2 text-[10px] font-mono text-slate-400 dark:text-slate-500">
                {JSON.stringify(lastResult, null, 2)}
              </pre>
            )}
          </div>
        ) : <span className="text-xs text-slate-600">Never</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button title={cron.status === 'ACTIVE' ? 'Pause' : 'Activate'} onClick={onToggle} disabled={isToggling || cron.status === 'INACTIVE'}
            className={clsx('rounded-lg p-1.5 transition-colors disabled:opacity-40', cron.status === 'ACTIVE' ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10')}>
            {isToggling ? <RefreshCw size={13} className="animate-spin" /> : cron.status === 'ACTIVE' ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button title="Trigger now" onClick={onTrigger} disabled={isTriggering} className="rounded-lg p-1.5 text-sky-600 dark:text-sky-400 transition-colors hover:bg-sky-500/10 disabled:opacity-40">
            {isTriggering ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
          <button title="Delete" onClick={onDelete} disabled={isDeleting} className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40">
            {isDeleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </td>
    </tr>
  )
}

const WORKER_PRESETS = [
  { key: 'ticks/regular',    queue: 'jobs.ticks.regular',    path: '/ticks/regular',    label: 'Ticks Regular' },
  { key: 'ticks/backfill',   queue: 'jobs.ticks.backfill',   path: '/ticks/backfill',   label: 'Ticks Backfill' },
  { key: 'candles/regular',  queue: 'jobs.candles.regular',  path: '/candles/regular',  label: 'Candles Regular' },
  { key: 'candles/backfill', queue: 'jobs.candles.backfill', path: '/candles/backfill', label: 'Candles Backfill' },
  { key: 'maintenance',      queue: 'jobs.maintenance',      path: '/maintenance',      label: 'Maintenance' },
  { key: 'sync',             queue: 'jobs.sync',             path: '/sync',             label: 'Outbox Sync' },
]

function AddCronForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: '', description: '', cronExpr: '*/5 * * * *',
    workerKey: 'maintenance', triggerMethod: 'RABBITMQ' as CronTriggerMethod,
    queueName: 'jobs.maintenance', httpPath: '/maintenance', status: 'ACTIVE' as CronStatus,
  })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: api.crons.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crons'] }); onClose() },
    onError: (e: Error) => setError(e.message),
  })

  const applyPreset = (p: typeof WORKER_PRESETS[0]) =>
    setForm((prev) => ({ ...prev, name: p.key.replace('/', '-'), workerKey: p.key, queueName: p.queue, httpPath: p.path }))

  return (
    <Card title="New Scheduled Job" subtitle="Triggers via RabbitMQ on cron schedule"
      action={<button onClick={onClose} className="rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:bg-sky-900/30 hover:text-slate-700 dark:text-slate-300"><X size={15} /></button>}
      className="flex-shrink-0 w-72 border-slate-300 dark:border-slate-700/60 bg-white dark:bg-[#071628] shadow-2xl"
      bodyClassName="p-4 space-y-3"
    >
      {/* Presets */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-400 dark:text-slate-500">Worker Preset</label>
        <div className="flex flex-wrap gap-1.5">
          {WORKER_PRESETS.map((p) => (
            <button key={p.key} onClick={() => applyPreset(p)}
              className={clsx('rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                form.workerKey === p.key ? 'border-sky-500/60 bg-sky-500/10 text-sky-700 dark:text-sky-300' : 'border-slate-200 dark:border-sky-900/30 shadow-sm text-slate-400 dark:text-slate-500 hover:border-slate-600 hover:text-slate-700 dark:text-slate-300')}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {[
        { k: 'name', l: 'Name', ph: 'e.g. ticks-regular' },
        { k: 'cronExpr', l: 'Cron Expression (UTC)', ph: '*/5 * * * *' },
        { k: 'queueName', l: 'RabbitMQ Queue', ph: 'jobs.ticks.regular' },
        { k: 'description', l: 'Description', ph: 'Optional' },
      ].map(({ k, l, ph }) => (
        <div key={k}>
          <label className="mb-1 block text-xs font-semibold text-slate-400 dark:text-slate-500">{l}</label>
          <input type="text" placeholder={ph} value={(form as any)[k]}
            onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))}
            className="w-full rounded-lg border border-slate-200 dark:border-sky-900/30 shadow-sm bg-[#040E1C] px-3 py-1.5 text-sm text-slate-800 dark:text-sky-100 placeholder-slate-700 outline-none focus:border-sky-500/80" />
        </div>
      ))}
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-400 dark:text-slate-500">Status</label>
        <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as CronStatus }))}
          className="w-full rounded-lg border border-slate-200 dark:border-sky-900/30 shadow-sm bg-[#040E1C] px-3 py-1.5 text-sm text-slate-800 dark:text-sky-100 outline-none focus:border-sky-500/80">
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
        </select>
      </div>
      {error && <p className="rounded border border-rose-500/10 bg-rose-500/5 px-3 py-2 text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2 border-t border-slate-200 dark:border-sky-900/30 shadow-sm/60 pt-3">
        <button onClick={() => mut.mutate({ ...form, description: form.description || undefined })}
          disabled={mut.isPending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white hover:bg-sky-500 disabled:opacity-50">
          <Zap size={12} />{mut.isPending ? 'Creating…' : 'Create'}
        </button>
        <button onClick={onClose} className="rounded-lg border border-slate-200 dark:border-sky-900/30 shadow-sm px-3 py-2 text-sm text-slate-400 dark:text-slate-500 hover:bg-sky-900/30">Cancel</button>
      </div>
    </Card>
  )
}

function ScheduledJobsTab({ onLog }: { onLog: (entry: Omit<LogEntry, 'id'>) => void }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['crons'],
    queryFn: api.crons.list,
    refetchInterval: 15_000,
  })

  const mutToggle = useMutation({
    mutationFn: api.crons.toggleStatus,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crons'] }),
  })

  const mutTrigger = useMutation({
    mutationFn: (id: string) => api.crons.trigger(id),
    onSuccess: (result, id) => {
      qc.invalidateQueries({ queryKey: ['crons'] })
      const cron = data?.find((c) => c.id === id)
      onLog({
        label: cron?.name ?? id,
        mode: 'MQ',
        success: result.success,
        ts: new Date().toISOString().slice(11, 19),
        detail: cron?.queueName ?? cron?.httpPath ?? '',
      })
    },
    onError: (err: Error, id) => {
      const cron = data?.find((c) => c.id === id)
      onLog({ label: cron?.name ?? id, mode: 'MQ', success: false, ts: new Date().toISOString().slice(11, 19), detail: err.message })
    },
  })

  const mutDelete = useMutation({
    mutationFn: api.crons.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crons'] }),
  })

  const active = data?.filter((c) => c.status === 'ACTIVE').length ?? 0

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      {/* Stats + New Job */}
      <div className="flex flex-shrink-0 items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
          <span><span className="font-bold text-slate-800 dark:text-sky-100">{data?.length ?? 0}</span> total</span>
          <span><span className="font-bold text-emerald-400">{active}</span> active</span>
          <span><span className="font-bold text-amber-400">{(data?.length ?? 0) - active}</span> paused</span>
          <span className="inline-flex items-center gap-1 rounded border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-400">
            <Rabbit size={9} />{data?.filter((c) => c.triggerMethod === 'RABBITMQ').length ?? 0} via MQ
          </span>
        </div>
        <button
          onClick={() => setShowForm((p) => !p)}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
            showForm
              ? 'bg-sky-900/30 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
              : 'bg-sky-600 text-slate-900 dark:text-white hover:bg-sky-500'
          )}
        >
          {showForm ? <X size={12} /> : <Plus size={12} />}
          {showForm ? 'Cancel' : 'New Job'}
        </button>
      </div>

      {/* Content: table + optional form */}
      <div className="flex min-h-0 flex-1 gap-3">
        <Card noPadding scrollable className="flex-1 min-w-0">
          {isLoading && <div className="flex h-40 items-center justify-center"><RefreshCw size={18} className="animate-spin text-slate-600" /></div>}
          {isError && <div className="flex h-40 items-center justify-center text-sm text-red-400">Failed to load — is the backend running?</div>}
          {data && (
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-white dark:bg-[#071628]">
                <tr className="border-b border-slate-200 dark:border-sky-900/30 shadow-sm">
                  {['Status', 'Name', 'Expression', 'Next Run', 'Queue', 'Last Run', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((cron) => (
                  <CronRow key={cron.id} cron={cron}
                    onToggle={() => mutToggle.mutate(cron.id)}
                    onTrigger={() => mutTrigger.mutate(cron.id)}
                    onDelete={() => { if (confirm(`Delete "${cron.name}"?`)) mutDelete.mutate(cron.id) }}
                    isToggling={mutToggle.isPending && mutToggle.variables === cron.id}
                    isTriggering={mutTrigger.isPending && mutTrigger.variables === cron.id}
                    isDeleting={mutDelete.isPending && mutDelete.variables === cron.id}
                  />
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={7} className="py-16 text-center text-sm text-slate-600">No cron jobs — click "New Job" to create one</td></tr>
                )}
              </tbody>
            </table>
          )}
        </Card>

        {showForm && <AddCronForm onClose={() => setShowForm(false)} />}
      </div>
    </div>
  )
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function ControlCenterPage() {
  const [tab, setTab] = useState<Tab>('manual')
  const [log, setLog] = useState<LogEntry[]>([])
  const [logCounter, setLogCounter] = useState(0)

  const pushLog = (entry: Omit<LogEntry, 'id'>) => {
    setLog((prev) => [{ ...entry, id: logCounter }, ...prev.slice(0, 49)])
    setLogCounter((n) => n + 1)
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      {/* ── Banner ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-3 rounded-xl border border-amber-500/10 bg-amber-500/5 px-4 py-3">
        <Cpu size={14} className="flex-shrink-0 text-amber-400" />
        <p className="text-xs text-slate-400 dark:text-slate-500 leading-snug">
          <span className="font-semibold text-amber-400">Dual-mode trigger system</span>
          {' '}· Manual via{' '}
          <span className="font-mono text-blue-400">REST → Go Daemon (192.168.1.8:8080)</span>
          {' '}· Scheduled via{' '}
          <span className="font-mono text-purple-400">RabbitMQ → Go Consumer (192.168.1.8:5672)</span>
          {' '}· Both return HTTP 202 Accepted (async processing)
        </p>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-1 self-start rounded-xl border border-slate-200 dark:border-sky-900/30 shadow-sm bg-[#040F1E] p-1">
        {([
          { id: 'manual', label: 'Manual Triggers', icon: Zap, badge: 'REST', badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
          { id: 'scheduled', label: 'Scheduled Jobs', icon: Clock, badge: 'RabbitMQ', badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
        ] as const).map(({ id, label, icon: Icon, badge, badgeColor }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
              tab === id
                ? 'bg-white dark:bg-[#071628] text-slate-800 dark:text-sky-100 shadow-sm border border-slate-300 dark:border-slate-700/50'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300'
            )}
          >
            <Icon size={14} strokeWidth={tab === id ? 2.5 : 2} />
            {label}
            <span className={clsx('rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider', badgeColor)}>
              {badge}
            </span>
          </button>
        ))}
      </div>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Tab content */}
        <div className="flex-1 min-w-0 min-h-0">
          {tab === 'manual' && <ManualTriggersTab onLog={pushLog} />}
          {tab === 'scheduled' && <ScheduledJobsTab onLog={pushLog} />}
        </div>

        {/* Unified activity log */}
        <Card
          title="Activity Log"
          subtitle={`${log.length} entries · REST + MQ`}
          className="w-72 flex-shrink-0"
          scrollable
          noPadding
          bodyClassName="p-3 space-y-2"
        >
          {log.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
              <div className="h-10 w-10 rounded-full border border-slate-200 dark:border-sky-900/30 shadow-sm flex items-center justify-center">
                <Send size={16} className="text-slate-700 dark:text-slate-300" />
              </div>
              <p className="text-xs text-slate-600">No activity yet.<br />Trigger a job or fire a cron.</p>
            </div>
          ) : (
            log.map((entry) => <LogItem key={entry.id} entry={entry} />)
          )}
        </Card>
      </div>
    </div>
  )
}
