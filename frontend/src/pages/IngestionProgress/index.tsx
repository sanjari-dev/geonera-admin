import { useQuery } from '@tanstack/react-query'
import { Clock, PauseCircle, TrendingUp, RefreshCw, BarChart2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Skeleton, KpiCardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { api } from '@/lib/api'
import type { ProgressEntry } from '@/types'
import { clsx } from 'clsx'

function ProgressBar({
  value,
  color,
  label,
  confirmed,
  total,
}: {
  value: number
  color: string
  label: string
  confirmed: number
  total: number
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-slate-400 dark:text-slate-500 font-medium">{label}</span>
        <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-300">
          {confirmed.toLocaleString()} <span className="text-slate-600 font-medium">/</span> {total.toLocaleString()}
          <span className={clsx('ml-1.5 font-bold', value >= 95 ? 'text-emerald-400' : 'text-slate-400 dark:text-slate-500')}>({value}%)</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white dark:bg-[#071628] border border-slate-200 dark:border-sky-900/30 shadow-sm/60 p-[1px]">
        <div
          className={clsx('h-full rounded-full transition-all duration-700 ease-out shadow', color)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

function InstrumentCard({ entry }: { entry: ProgressEntry }) {
  const startDate = entry.startDate ? new Date(entry.startDate) : null
  const latestTick = entry.latestTickDate ? new Date(entry.latestTickDate) : null
  const latestCandle = entry.latestCandleDate ? new Date(entry.latestCandleDate) : null

  return (
    <div className="glow-card border border-slate-200 dark:border-sky-900/30 bg-[#111520] p-[18px] rounded-xl transition-all duration-300 shadow-lg">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {entry.isPause && <PauseCircle size={14} className="flex-shrink-0 text-amber-500 animate-pulse" />}
          <span className="font-mono text-sm font-bold uppercase text-slate-100 tracking-wide truncate">
            {entry.instrumentName}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={clsx(
              'rounded-md border px-2 py-0.5 text-[9px] font-extrabold tracking-wider',
              entry.tickProgress >= 90
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : entry.tickProgress >= 50
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            )}
          >
            {entry.tickProgress}% TICK
          </span>
          <span
            className={clsx(
              'rounded-md border px-2 py-0.5 text-[9px] font-extrabold tracking-wider',
              entry.candleProgress >= 90
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : entry.candleProgress >= 50
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            )}
          >
            {entry.candleProgress}% CANDLE
          </span>
        </div>
      </div>

      {/* Progress bars */}
      <div className="mb-4.5 space-y-3.5">
        <ProgressBar
          value={entry.tickProgress}
          color="bg-gradient-to-r from-sky-600 to-sky-500"
          label="TICK (hourly files)"
          confirmed={entry.tickConfirmed}
          total={entry.expectedTickHours}
        />
        <ProgressBar
          value={entry.candleProgress}
          color="bg-gradient-to-r from-pink-600 to-pink-500"
          label="CANDLE (daily files)"
          confirmed={entry.candleConfirmed}
          total={entry.expectedCandleDays}
        />
      </div>

      {/* Dates row */}
      <div className="grid grid-cols-3 gap-2 border-t border-slate-200 dark:border-sky-900/30 pt-3">
        <div>
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase">Start Date</p>
          <p className="font-mono text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">{startDate ? startDate.toLocaleDateString() : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase">Latest TICK</p>
          <p className="font-mono text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
            {latestTick ? latestTick.toLocaleDateString() : <span className="text-slate-700 dark:text-slate-300">—</span>}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase">Latest CANDLE</p>
          <p className="font-mono text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
            {latestCandle ? latestCandle.toLocaleDateString() : <span className="text-slate-700 dark:text-slate-300">—</span>}
          </p>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-sky-900/30 bg-[#111520] px-5 py-4 shadow-md">
      <div className={clsx('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#040E1C]/20 border border-slate-200 dark:border-sky-900/30', color)}>
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
        <p className="text-xl font-bold tabular-nums text-slate-100 mt-0.5">{value}</p>
      </div>
    </div>
  )
}

export default function IngestionProgressPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['progress'],
    queryFn: api.progress.list,
  })

  const avgTick = data?.length
    ? Math.round(data.reduce((a, d) => a + d.tickProgress, 0) / data.length)
    : 0
  const avgCandle = data?.length
    ? Math.round(data.reduce((a, d) => a + d.candleProgress, 0) / data.length)
    : 0
  const fullyDone = data?.filter((d) => d.tickProgress >= 100 && d.candleProgress >= 100).length ?? 0

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      {/* Summary row */}
      <div className="flex-shrink-0 grid grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <SummaryCard label="Avg TICK Progress" value={`${avgTick}%`} icon={TrendingUp} color="text-sky-600 dark:text-sky-400" />
            <SummaryCard label="Avg CANDLE Progress" value={`${avgCandle}%`} icon={BarChart2} color="text-pink-400" />
            <SummaryCard label="Fully Synced Symbols" value={`${fullyDone} / ${data?.length ?? 0}`} icon={Clock} color="text-emerald-400" />
          </>
        )}
      </div>

      {/* Instrument cards grid — scrollable */}
      <div className="flex-1 min-h-0 overflow-auto pr-1">
        {isLoading && (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-slate-200 dark:border-sky-900/30 bg-[#111520] p-[18px] rounded-xl space-y-4 shadow">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-7 w-full" />
                  <Skeleton className="h-7 w-full" />
                </div>
                <Skeleton className="h-6 w-full pt-2" />
              </div>
            ))}
          </div>
        )}
        {isError && <EmptyState title="Sync check failed" message="An error occurred while computing progress status." icon={RefreshCw} />}
        {!isLoading && !isError && data && data.length === 0 && <EmptyState title="No active pipelines" message="Enable some currency symbols to begin progress synchronization." />}
        {data && data.length > 0 && (
          <div className="grid gap-3.5 pb-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))' }}>
            {data.map((entry) => (
              <InstrumentCard key={entry.instrumentId} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
