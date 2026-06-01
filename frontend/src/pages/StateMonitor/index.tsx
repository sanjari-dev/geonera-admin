import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, Legend, ResponsiveContainer,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TableSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { api } from '@/lib/api'
import type { StateStatus } from '@/types'
import { STATUS_COLORS } from '@/lib/constants'

// Premium custom tooltip for Recharts
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-300 dark:border-slate-700/60 bg-[#0F121D]/95 px-4 py-3 shadow-2xl backdrop-blur-md">
        <p className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</p>
        <div className="mt-2 space-y-1">
          {payload.map((p: any) => (
            <div key={p.name} className="flex items-center gap-4 justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.fill ?? p.color }} />
                {p.name}:
              </span>
              <span className="font-mono font-bold text-slate-100">{p.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

export default function StateMonitorPage() {
  const dist = useQuery({ queryKey: ['states', 'distribution'], queryFn: api.states.distribution })
  const recent = useQuery({
    queryKey: ['states', 'recent'],
    queryFn: () => api.states.recent({ limit: 100 }),
  })

  // Aggregate for charts
  const byStatus = dist.data
    ? Object.entries(
        dist.data.reduce<Record<string, number>>((acc, d) => {
          acc[d.status] = (acc[d.status] ?? 0) + d.count
          return acc
        }, {})
      )
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count)
    : []

  const byJobType = dist.data
    ? [
        {
          name: 'TICK',
          ...dist.data
            .filter((d) => d.jobType === 'TICK')
            .reduce<Record<string, number>>((a, d) => ({ ...a, [d.status]: d.count }), {}),
        },
        {
          name: 'CANDLE',
          ...dist.data
            .filter((d) => d.jobType === 'CANDLE')
            .reduce<Record<string, number>>((a, d) => ({ ...a, [d.status]: d.count }), {}),
        },
      ]
    : []

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      {/* Charts row */}
      <div className="flex-shrink-0 grid grid-cols-2 gap-4" style={{ height: 280 }}>
        <Card title="Distribution by Status" subtitle="All job types combined">
          {dist.isLoading && <ChartSkeleton />}
          {dist.isError && <EmptyState title="Loading failed" message="Could not fetch status distribution." />}
          {dist.data && (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byStatus} margin={{ top: 10, right: 8, bottom: 24, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="status"
                  tick={{ fontSize: 9, fill: '#64748b', fontWeight: 500 }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={{ stroke: '#334155' }}
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  width={45}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={{ stroke: '#334155' }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(51, 65, 85, 0.15)' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {byStatus.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status as StateStatus] ?? '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="TICK vs CANDLE Breakdown" subtitle="Status count per job type">
          {dist.isLoading && <ChartSkeleton />}
          {dist.isError && <EmptyState title="Loading failed" message="Could not fetch job type breakdown." />}
          {dist.data && (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byJobType} margin={{ top: 10, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={{ stroke: '#334155' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  width={45}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={{ stroke: '#334155' }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(51, 65, 85, 0.15)' }} />
                <Legend wrapperStyle={{ fontSize: 10, fill: '#64748b', paddingTop: 10 }} />
                {Object.keys(STATUS_COLORS).map((s) => (
                  <Bar key={s} dataKey={s} name={s} stackId="a" fill={STATUS_COLORS[s as StateStatus]} radius={[0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Recent states table */}
      <Card
        title="Recent State Records"
        subtitle="Last 100 updated · ordered by updatedAt desc"
        className="flex-1 min-h-0"
        noPadding
        scrollable
      >
        {recent.isLoading && <TableSkeleton cols={6} rows={8} />}
        {recent.isError && <EmptyState title="Could not load records" message="An error occurred while fetching state records." />}
        {recent.data && recent.data.data.length === 0 && <EmptyState title="No records found" message="There are no recent states available." />}
        {recent.data && recent.data.data.length > 0 && (
          <div className="h-full w-full overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-[#040E1C]/90 backdrop-blur-md border-b border-slate-200 dark:border-sky-900/30 shadow-sm/80">
                <tr>
                  {['Instrument', 'Job Type', 'Timestamp', 'Status', 'Retry', 'Updated At'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {recent.data.data.map((s, idx) => (
                  <tr key={s.id} className="interactive-element group border-b border-slate-200 dark:border-sky-900/30 shadow-sm/30 hover:bg-sky-900/30/30 transition-colors duration-150">
                    <td className="px-4 py-2.5 font-mono text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                      {s.instrument?.name ?? s.instrumentId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider ${s.jobType === 'TICK' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20' : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'}`}>
                        {s.jobType}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-400 dark:text-slate-500">
                      {new Date(s.timestamp).toISOString().slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={s.status} size="xs" />
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-400 dark:text-slate-500">
                      {s.retryCount > 0 ? (
                        <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-400 border border-red-500/20">{s.retryCount}</span>
                      ) : (
                        <span className="text-slate-600 font-mono">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-400 dark:text-slate-500">
                      {new Date(s.updatedAt).toISOString().slice(0, 19).replace('T', ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
