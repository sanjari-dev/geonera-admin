import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { Plus, Search, PauseCircle, Ban, Sparkles, X, Sliders, Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { api } from '@/lib/api'
import type { Instrument, Timeframe } from '@/types'
import { clsx } from 'clsx'

// ─── Add Instrument Form ─────────────────────────────────────────────────────
function AddForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: '',
    description: '',
    assetClass: 'forex',
    divider: 100000,
    startDate: '2020-01-01T00:00:00Z',
    isActive: true,
  })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: api.instruments.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instruments'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  const handleSubmit = () => {
    if (!form.name) {
      setError('Symbol name is required')
      return
    }
    mut.mutate({
      name: form.name,
      description: form.description || undefined,
      assetClass: form.assetClass || undefined,
      divider: form.divider || undefined,
      startDate: form.startDate || undefined,
      isActive: form.isActive,
    })
  }

  return (
    <Card 
      title="Create Instrument" 
      subtitle="Register a new currency or asset"
      action={
        <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors">
          <X size={15} />
        </button>
      }
      className="w-80 flex-shrink-0 animate-in fade-in slide-in-from-right-4 duration-350 border border-slate-700/60 bg-[#0F121C] shadow-2xl" 
      bodyClassName="p-4 space-y-4"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold tracking-wide text-slate-400">Symbol Symbol *</label>
          <input
            type="text"
            placeholder="e.g. eurusd"
            className="w-full rounded-lg border border-slate-800 bg-[#090B11] px-3.5 py-2 text-sm text-slate-200 placeholder-slate-700 outline-none transition-all focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold tracking-wide text-slate-400">Description</label>
          <input
            type="text"
            placeholder="e.g. Euro / US Dollar"
            className="w-full rounded-lg border border-slate-800 bg-[#090B11] px-3.5 py-2 text-sm text-slate-200 placeholder-slate-700 outline-none transition-all focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold tracking-wide text-slate-400">Asset Class</label>
          <select
            className="w-full rounded-lg border border-slate-800 bg-[#090B11] px-3.5 py-2 text-sm text-slate-200 outline-none transition-all focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10"
            value={form.assetClass}
            onChange={(e) => setForm((p) => ({ ...p, assetClass: e.target.value }))}
          >
            {['forex', 'commodity', 'crypto', 'index', 'stock'].map((c) => (
              <option key={c} value={c}>{c.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold tracking-wide text-slate-400">Price Divider</label>
          <input
            type="number"
            placeholder="100000"
            className="w-full rounded-lg border border-slate-800 bg-[#090B11] px-3.5 py-2 text-sm text-slate-200 placeholder-slate-700 outline-none transition-all focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10"
            value={form.divider}
            onChange={(e) => setForm((p) => ({ ...p, divider: Number(e.target.value) }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold tracking-wide text-slate-400">Start Date (UTC ISO)</label>
          <input
            type="text"
            placeholder="2020-01-01T00:00:00Z"
            className="w-full rounded-lg border border-slate-800 bg-[#090B11] px-3.5 py-2 text-sm text-slate-200 placeholder-slate-700 outline-none transition-all focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10"
            value={form.startDate}
            onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
          />
        </div>

        {error && <p className="rounded-lg border border-rose-500/10 bg-rose-500/5 px-3 py-2 text-xs text-rose-400 font-medium">{error}</p>}

        <div className="flex gap-2 pt-2 border-t border-slate-800/80">
          <button
            onClick={handleSubmit}
            disabled={mut.isPending}
            className="interactive-element flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] hover:bg-indigo-500 disabled:opacity-50"
          >
            <Sparkles size={13} />
            {mut.isPending ? 'Adding…' : 'Submit'}
          </button>
          <button
            onClick={onClose}
            className="interactive-element rounded-lg border border-slate-800 bg-[#161B27] px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </Card>
  )
}

// ─── Toggle Switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={clsx(
        'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full transition-all duration-300 ease-out border shadow-inner',
        checked ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-slate-700',
        disabled && 'cursor-not-allowed opacity-40'
      )}
    >
      <span
        className={clsx(
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition-transform duration-300 ease-out',
          checked ? 'translate-x-4.5' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

// ─── Timeframe Management Panel ────────────────────────────────────────────────
function TimeframePanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: timeframes, isLoading, isError } = useQuery<Timeframe[]>({
    queryKey: ['timeframes'],
    queryFn: api.timeframes.list,
  })

  const mutActive = useMutation({
    mutationFn: api.timeframes.toggleActive,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timeframes'] })
    },
  })

  return (
    <Card
      title="Timeframe Management"
      subtitle="Manage Dukascopy candle aggregation timeframes"
      action={
        <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors">
          <X size={15} />
        </button>
      }
      className="w-96 h-full flex-shrink-0 animate-in fade-in slide-in-from-right-4 duration-350 border border-slate-700/60 bg-[#0F121C] shadow-2xl"
      bodyClassName="p-4 flex flex-col h-full min-h-0"
    >
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-0">
        {isLoading && (
          <div className="flex flex-col gap-2 py-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-slate-800/40" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-rose-500/10 bg-rose-500/5 px-3 py-4 text-center text-xs text-rose-400 font-medium">
            Failed to load timeframes.
          </div>
        )}

        {!isLoading && !isError && timeframes && (
          <div className="space-y-2">
            <div className="rounded-lg border border-indigo-500/15 bg-indigo-500/5 p-3 mb-3">
              <span className="text-[10px] font-semibold text-indigo-300 block mb-1 leading-snug">
                ⚠️ ARCHITECTURE NOTICE
              </span>
              <p className="text-[10px] text-slate-400 leading-normal">
                These 19 standard timeframes are baked into the Go Dukascopy ingestion architecture. Turning a timeframe off disables its Candle aggregation pipeline.
              </p>
            </div>

            {timeframes.map((tf) => (
              <div
                key={tf.id}
                className={clsx(
                  "flex items-center justify-between p-3 rounded-lg border transition-all duration-150",
                  tf.isActive
                    ? "border-slate-800 bg-slate-900/40 hover:bg-slate-900/60"
                    : "border-slate-900/60 bg-slate-950/20 opacity-70"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    "flex items-center justify-center h-8 w-8 rounded-lg border",
                    tf.isActive 
                      ? "bg-indigo-500/5 border-indigo-500/20 text-indigo-400" 
                      : "bg-slate-900 border-slate-800 text-slate-600"
                  )}>
                    <Clock size={14} className={clsx(tf.isActive && "animate-pulse")} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono text-sm font-bold uppercase tracking-wider text-slate-100">
                      {tf.name}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">
                      {tf.minutes >= 1440 
                        ? `${tf.minutes / 1440} Day(s)` 
                        : tf.minutes >= 60 
                          ? `${tf.minutes / 60} Hour(s)` 
                          : `${tf.minutes} Minute(s)`
                      } ({tf.minutes}m)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={clsx(
                    "text-[9px] font-bold uppercase tracking-widest",
                    tf.isActive ? "text-indigo-400" : "text-slate-600"
                  )}>
                    {tf.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                  <Toggle
                    checked={tf.isActive}
                    onChange={() => mutActive.mutate(tf.id)}
                    disabled={mutActive.isPending}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const col = createColumnHelper<Instrument>()

export default function InstrumentsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showTimeframes, setShowTimeframes] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['instruments'],
    queryFn: api.instruments.list,
  })

  const mutActive = useMutation({
    mutationFn: api.instruments.toggleActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instruments'] }),
  })
  const mutPause = useMutation({
    mutationFn: api.instruments.togglePause,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instruments'] }),
  })

  const columns = [
    col.accessor('name', {
      header: 'Symbol',
      cell: (i) => <span className="font-mono text-sm font-bold uppercase tracking-wide text-slate-100">{i.getValue()}</span>,
    }),
    col.accessor('description', {
      header: 'Description',
      cell: (i) => <span className="text-slate-400 text-xs font-medium">{i.getValue() ?? <span className="text-slate-600">—</span>}</span>,
    }),
    col.accessor('assetClass', {
      header: 'Asset Class',
      cell: (i) => {
        const v = i.getValue()
        return v
          ? <span className="rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{v}</span>
          : <span className="text-slate-600">—</span>
      },
    }),
    col.accessor('divider', {
      header: 'Divider',
      cell: (i) => {
        const v = i.getValue()
        return v !== null
          ? <span className="font-mono text-xs font-medium text-slate-300">{v.toLocaleString()}</span>
          : <span className="text-slate-600">—</span>
      },
    }),
    col.accessor('startDate', {
      header: 'Start Date',
      cell: (i) => {
        const v = i.getValue()
        return v
          ? <span className="font-mono text-xs text-slate-400">{new Date(v).toLocaleDateString()}</span>
          : <span className="text-slate-600">—</span>
      },
    }),
    col.accessor('isActive', {
      header: 'Active Status',
      cell: (i) => (
        <div className="flex items-center gap-3">
          <Toggle
            checked={i.getValue()}
            onChange={() => mutActive.mutate(i.row.original.id)}
            disabled={mutActive.isPending}
          />
          <span className={clsx('text-[10px] font-bold uppercase tracking-wider', i.getValue() ? 'text-indigo-400' : 'text-slate-600')}>
            {i.getValue() ? 'Online' : 'Offline'}
          </span>
        </div>
      ),
    }),
    col.accessor('isPause', {
      header: 'Ingestion State',
      cell: (i) => (
        <div className="flex items-center gap-3">
          <Toggle
            checked={i.getValue()}
            onChange={() => mutPause.mutate(i.row.original.id)}
            disabled={mutPause.isPending}
          />
          <span className="flex items-center gap-1.5">
            <span className={clsx('text-[10px] font-bold uppercase tracking-wider', i.getValue() ? 'text-amber-500' : 'text-emerald-400')}>
              {i.getValue() ? 'Paused' : 'Running'}
            </span>
            {i.getValue() && <PauseCircle size={13} className="text-amber-500 animate-pulse" />}
          </span>
        </div>
      ),
    }),
  ]

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      {/* Header Controls */}
      <div className="flex flex-shrink-0 items-center justify-between gap-3 bg-[#111520] p-3.5 rounded-xl border border-slate-800/80">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="w-full rounded-lg border border-slate-800 bg-[#090B11] py-2 pl-9 pr-3 text-xs text-slate-300 placeholder-slate-700 outline-none transition-all focus:border-indigo-500/80"
            placeholder="Filter by Symbol..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:inline">{data?.length ?? 0} Instruments Total</span>
          
          <button
            onClick={() => {
              setShowTimeframes((p) => !p)
              setShowForm(false)
            }}
            className={clsx(
              "interactive-element flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-bold transition-all shadow-sm",
              showTimeframes
                ? "bg-slate-800 border-slate-700 text-indigo-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            )}
          >
            <Sliders size={13} />
            MANAGE TIMEFRAMES
          </button>

          <button
            onClick={() => {
              setShowForm((p) => !p)
              setShowTimeframes(false)
            }}
            className={clsx(
              "interactive-element flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-[0_2px_8px_rgba(79,70,229,0.25)] transition-all",
              showForm ? "bg-indigo-500" : "bg-indigo-600 hover:bg-indigo-500"
            )}
          >
            <Plus size={14} strokeWidth={2.5} />
            ADD INSTRUMENT
          </button>
        </div>
      </div>

      {/* Main Grid Body */}
      <div className="flex min-h-0 flex-1 gap-4">
        <Card className="flex-1 min-w-0 bg-[#111520] border-slate-800/80" noPadding scrollable>
          {isLoading && <TableSkeleton cols={7} rows={8} />}
          {isError && <EmptyState title="Loading failed" message="An error occurred while fetching currency instruments." icon={Ban} />}
          {!isLoading && !isError && data && data.length === 0 && <EmptyState title="No instruments registered" message="Register a currency symbol to start data ingestion." />}
          {!isLoading && !isError && data && data.length > 0 && (
            <div className="h-full w-full overflow-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-md">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => (
                        <th
                          key={header.id}
                          className="cursor-pointer select-none px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-300"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <div className="flex items-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <span className="font-mono font-medium text-indigo-400">
                              {header.column.getIsSorted() === 'asc' ? ' ▲' : header.column.getIsSorted() === 'desc' ? ' ▼' : ''}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="interactive-element group hover:bg-slate-800/20 border-b border-slate-800/30 transition-colors duration-150">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 text-xs text-slate-300">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {showForm && <AddForm onClose={() => setShowForm(false)} />}
        {showTimeframes && <TimeframePanel onClose={() => setShowTimeframes(false)} />}
      </div>
    </div>
  )
}
