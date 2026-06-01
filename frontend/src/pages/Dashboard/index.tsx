import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  PauseCircle,
  RefreshCw,
  Wifi,
  Workflow,
  Sparkles,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { StatusCell } from '@/components/ui/StatusBadge'
import { KpiCardSkeleton, TableSkeleton, Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { api } from '@/lib/api'
import type { HeatmapEntry, KpiStats } from '@/types'
import { STATUS_CLASSES } from '@/lib/constants'
import { clsx } from 'clsx'

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
  sub?: string
}) {
  return (
    <div className="glow-card flex items-center gap-4 rounded-xl border border-slate-200 dark:border-sky-900/30 shadow-sm/80 bg-[#111520] px-5 py-4 transition-all duration-350 shadow-md">
      <div className={clsx('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-white/5 shadow-inner', color)}>
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-100 leading-none">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {sub && <p className="text-[11px] font-medium text-slate-600 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────
function Heatmap({ data }: { data: HeatmapEntry[] }) {
  if (data.length === 0) {
    return <EmptyState title="Heatmap empty" message="No currency instruments registered." />
  }

  return (
    <div className="w-full h-full overflow-auto pr-1">
      {/* Header row */}
      <div className="sticky top-0 z-10 grid gap-3.5 bg-[#040E1C]/80 backdrop-blur border-b border-slate-200 dark:border-sky-900/30 shadow-sm/60 pb-2.5 mb-2.5" style={{ gridTemplateColumns: '150px 1fr 1fr' }}>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Instrument Symbol</div>
        <div className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">TICK Ingestion</div>
        <div className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">CANDLE Ingestion</div>
      </div>

      <div className="space-y-2">
        {data.map((entry) => (
          <div
            key={entry.instrumentId}
            className="interactive-element group grid gap-3.5 items-center hover:bg-sky-900/30/20 rounded-lg px-2 py-1 -mx-2 transition-all duration-150"
            style={{ gridTemplateColumns: '150px 1fr 1fr' }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {entry.isPause ? (
                <PauseCircle size={13} className="flex-shrink-0 text-amber-500 animate-pulse" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80 shadow shadow-emerald-500/50" />
              )}
              <span className="truncate font-mono text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-sky-100 group-hover:text-sky-600 dark:hover:text-sky-400 dark:text-sky-400 transition-colors">
                {entry.instrumentName}
              </span>
            </div>
            <StatusCell status={entry.tickStatus} count={entry.tickConfirmed} />
            <StatusCell status={entry.candleStatus} count={entry.candleConfirmed} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const kpis = useQuery({ queryKey: ['dashboard', 'kpis'], queryFn: api.dashboard.kpis })
  const heatmap = useQuery({ queryKey: ['dashboard', 'heatmap'], queryFn: api.dashboard.heatmap })

  const k: KpiStats = kpis.data ?? {
    totalInstruments: 0, activeInstruments: 0, pausedInstruments: 0,
    confirmedStates: 0, completedStates: 0, failedStates: 0, abandonedStates: 0,
    brokenStates: 0, pendingStates: 0, processedStates: 0, notFoundStates: 0, totalStates: 0,
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4">
        {kpis.isLoading ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              label="Pipeline Instruments"
              value={k.totalInstruments}
              icon={BarChart3}
              color="bg-sky-600/10 text-sky-600 dark:text-sky-400 border border-sky-500/10"
              sub={`${k.activeInstruments} active symbols · ${k.pausedInstruments} paused`}
            />
            <KpiCard
              label="Confirmed Operations"
              value={k.confirmedStates}
              icon={CheckCircle2}
              color="bg-emerald-600/10 text-emerald-400 border border-emerald-500/10"
              sub={`${k.completedStates.toLocaleString()} completed tasks`}
            />
            <KpiCard
              label="Pending & In-Flight"
              value={k.pendingStates + k.processedStates}
              icon={RefreshCw}
              color="bg-blue-600/10 text-blue-400 border border-blue-500/10"
              sub={`${k.notFoundStates.toLocaleString()} items not found`}
            />
            <KpiCard
              label="Failed / Attention Required"
              value={k.failedStates + k.abandonedStates + k.brokenStates}
              icon={AlertTriangle}
              color="bg-rose-600/10 text-rose-400 border border-rose-500/10"
              sub={`${k.brokenStates} broken · ${k.abandonedStates} abandoned`}
            />
          </>
        )}
      </div>

      {/* ── Content row ───────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Heatmap — takes 2/3 */}
        <Card
          title="Pipeline Ingestion Heatmap"
          subtitle="Dominant state per job type · TICK confirmed counts shown"
          className="flex-1 min-w-0 bg-[#111520] border-slate-200 dark:border-sky-900/30 shadow-sm/80"
          scrollable
          noPadding
          bodyClassName="p-4"
        >
          {heatmap.isLoading && <TableSkeleton cols={3} rows={8} />}
          {heatmap.isError && <EmptyState title="Heatmap load failed" message="An error occurred while compiling pipeline statuses." icon={Workflow} />}
          {heatmap.data && <Heatmap data={heatmap.data} />}
        </Card>

        {/* System health — takes 1/3 */}
        <div className="flex w-72 flex-shrink-0 flex-col gap-4">
          <Card title="System Health Status" className="flex-shrink-0 bg-[#111520] border-slate-200 dark:border-sky-900/30 shadow-sm/80">
            {kpis.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <SystemHealth totalStates={k.totalStates} kpis={k} />
            )}
          </Card>

          <Card title="Database State Breakdown" className="flex-1 bg-[#111520] border-slate-200 dark:border-sky-900/30 shadow-sm/80" scrollable>
            {kpis.isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <StateBreakdown kpis={k} />
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function SystemHealth({ totalStates, kpis }: { totalStates: number; kpis: KpiStats }) {
  const healthyCount = kpis.confirmedStates + kpis.completedStates
  const unhealthyCount = kpis.failedStates + kpis.abandonedStates + kpis.brokenStates
  const isHealthy = unhealthyCount === 0

  const healthItems = [
    { label: 'Total Index Records', value: totalStates.toLocaleString(), icon: Database, color: 'text-slate-400 dark:text-slate-500', ok: true },
    { label: 'Pipeline Health Rate', value: totalStates > 0 ? `${Math.round((healthyCount / totalStates) * 100)}%` : '—', icon: Activity, color: isHealthy ? 'text-emerald-400' : 'text-amber-400', ok: isHealthy },
    { label: 'Outages & Attention', value: unhealthyCount.toLocaleString(), icon: AlertTriangle, color: unhealthyCount === 0 ? 'text-slate-400 dark:text-slate-500' : 'text-red-400 animate-pulse', ok: unhealthyCount === 0 },
    { label: 'WS Signal Connection', value: 'Live Ping', icon: Wifi, color: 'text-emerald-400', ok: true },
  ]

  return (
    <div className="space-y-3">
      {healthItems.map(({ label, value, icon: Icon, color, ok }) => (
        <div key={label} className="flex items-center justify-between border-b border-slate-200 dark:border-sky-900/30 shadow-sm/35 pb-2 last:border-0 last:pb-0">
          <div className="flex items-center gap-2">
            <Icon size={13} className={clsx('stroke-[2.2px]', ok ? 'text-emerald-400' : 'text-red-400')} />
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{label}</span>
          </div>
          <span className={clsx('text-xs font-bold font-mono', color)}>
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}

function StateBreakdown({ kpis }: { kpis: KpiStats }) {
  const rows = [
    { label: 'CONFIRMED',  value: kpis.confirmedStates,  color: STATUS_CLASSES.CONFIRMED.bg },
    { label: 'COMPLETED',  value: kpis.completedStates,  color: STATUS_CLASSES.COMPLETED.bg },
    { label: 'PENDING',    value: kpis.pendingStates,    color: STATUS_CLASSES.PENDING.bg },
    { label: 'PROCESSED',  value: kpis.processedStates,  color: STATUS_CLASSES.PROCESSED.bg },
    { label: 'NOT_FOUND',  value: kpis.notFoundStates,   color: STATUS_CLASSES.NOT_FOUND.bg },
    { label: 'FAILED',     value: kpis.failedStates,     color: STATUS_CLASSES.FAILED.bg },
    { label: 'BROKEN',     value: kpis.brokenStates,     color: STATUS_CLASSES.BROKEN.bg },
    { label: 'ABANDONED',  value: kpis.abandonedStates,  color: STATUS_CLASSES.ABANDONED.bg },
  ]
  const total = kpis.totalStates || 1

  return (
    <div className="space-y-3 pr-1.5 pb-2">
      {rows.map(({ label, value, color }) => (
        <div key={label} className="group">
          <div className="mb-1 flex justify-between text-[11px] font-semibold">
            <span className="font-mono text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:text-slate-300 transition-colors">{label}</span>
            <span className="tabular-nums font-bold text-slate-400 dark:text-slate-500 group-hover:text-slate-800 dark:hover:text-slate-200 dark:text-sky-100 transition-colors">{value.toLocaleString()}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white dark:bg-[#071628] border border-slate-200 dark:border-sky-900/30 shadow-sm/40 p-[0.5px]">
            <div
              className={clsx('h-full rounded-full transition-all duration-500 ease-out shadow', color)}
              style={{ width: `${Math.min(100, (value / total) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
