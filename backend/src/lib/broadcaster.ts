/**
 * WebSocket broadcaster — polls data sources and pushes events to all
 * connected clients only when the payload has actually changed.
 *
 * Every poll function is fire-and-forget; errors are silently swallowed
 * so a single failing query never disrupts other broadcasters.
 */
import { prisma } from './prisma'
import { getNextRun } from './scheduler'

// ── Client registry ───────────────────────────────────────────────────────────

export const wsClients = new Set<{ send: (msg: string) => void }>()

function broadcast(msg: unknown) {
  if (wsClients.size === 0) return
  const str = JSON.stringify(msg)
  for (const ws of wsClients) {
    try { ws.send(str) } catch {}
  }
}

// Change-detection: skip broadcast when payload is identical to last sent.
const snapshots = new Map<string, string>()

function emitIfChanged(type: string, data: unknown) {
  const snap = JSON.stringify(data)
  if (snapshots.get(type) === snap) return
  snapshots.set(type, snap)
  broadcast({ type, data })
}

// ── Pollers ───────────────────────────────────────────────────────────────────

async function pollLocks() {
  if (wsClients.size === 0) return
  try {
    const data = await prisma.$queryRaw`
      SELECT
        l.objid::text                                     AS lock_id,
        l.pid, l.mode, l.granted,
        a.state                                           AS backend_state,
        a.query_start                                     AS held_since,
        EXTRACT(EPOCH FROM (now() - a.query_start))::int  AS held_seconds
      FROM   pg_locks        l
      LEFT   JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE  l.locktype = 'advisory'
      ORDER  BY a.query_start ASC
    `
    emitIfChanged('locks', data)
  } catch {}
}

async function pollKpis() {
  if (wsClients.size === 0) return
  try {
    const [total, active, paused, statusCounts] = await Promise.all([
      prisma.instrument.count(),
      prisma.instrument.count({ where: { isActive: true } }),
      prisma.instrument.count({ where: { isPause: true } }),
      prisma.state.groupBy({ by: ['status'], _count: { id: true }, where: { isDeleted: false } }),
    ])
    const sm: Record<string, number> = Object.fromEntries(statusCounts.map((s) => [s.status, s._count.id]))
    emitIfChanged('kpis', {
      totalInstruments: total,
      activeInstruments: active,
      pausedInstruments: paused,
      confirmedStates:  sm['CONFIRMED']  ?? 0,
      completedStates:  sm['COMPLETED']  ?? 0,
      failedStates:     sm['FAILED']     ?? 0,
      abandonedStates:  sm['ABANDONED']  ?? 0,
      brokenStates:     sm['BROKEN']     ?? 0,
      pendingStates:    sm['PENDING']    ?? 0,
      processedStates:  sm['PROCESSED']  ?? 0,
      notFoundStates:   sm['NOT_FOUND']  ?? 0,
      totalStates: statusCounts.reduce((a, s) => a + s._count.id, 0),
    })
  } catch {}
}

async function pollDistribution() {
  if (wsClients.size === 0) return
  try {
    const rows = await prisma.state.groupBy({
      by: ['status', 'jobType'],
      _count: { id: true },
      where: { isDeleted: false },
      orderBy: { _count: { id: 'desc' } },
    })
    emitIfChanged('distribution', rows.map((r) => ({ status: r.status, jobType: r.jobType, count: r._count.id })))
  } catch {}
}

async function pollActivity() {
  if (wsClients.size === 0) return
  try {
    const rows = await prisma.$queryRaw<{
      id: string; trigger_src: string; job_name: string
      triggered_at: Date; finished_at: Date | null
      duration_ms: bigint | null; trace_id: string | null
      meta: Record<string, string> | null
    }[]>`
      SELECT id::text, trigger_src, job_name, triggered_at, finished_at,
             duration_ms, trace_id, meta
      FROM   ingestion.job_activity_logs
      ORDER  BY (finished_at IS NULL) DESC, triggered_at DESC
      LIMIT  5
    `
    emitIfChanged('activity', rows.map((r) => ({ ...r, duration_ms: r.duration_ms != null ? Number(r.duration_ms) : null })))
  } catch {}
}

async function pollProgress() {
  if (wsClients.size === 0) return
  try {
    const instruments = await prisma.instrument.findMany({
      where: { isActive: true },
      select: { id: true, name: true, isPause: true, startDate: true },
      orderBy: { name: 'asc' },
    })
    const now = new Date()
    const [tickCounts, candleCounts, latestTicks, latestCandles] = await Promise.all([
      prisma.state.groupBy({ by: ['instrumentId', 'status'], where: { jobType: 'TICK',   isDeleted: false }, _count: { id: true } }),
      prisma.state.groupBy({ by: ['instrumentId', 'status'], where: { jobType: 'CANDLE', isDeleted: false }, _count: { id: true } }),
      prisma.state.groupBy({ by: ['instrumentId'], where: { jobType: 'TICK',   status: 'CONFIRMED', isDeleted: false }, _max: { timestamp: true } }),
      prisma.state.groupBy({ by: ['instrumentId'], where: { jobType: 'CANDLE', status: 'CONFIRMED', isDeleted: false }, _max: { timestamp: true } }),
    ])
    const tcMap = new Map<string, Record<string, number>>()
    tickCounts.forEach((r) => { const m = tcMap.get(r.instrumentId) ?? {}; m[r.status] = r._count.id; tcMap.set(r.instrumentId, m) })
    const ccMap = new Map<string, Record<string, number>>()
    candleCounts.forEach((r) => { const m = ccMap.get(r.instrumentId) ?? {}; m[r.status] = r._count.id; ccMap.set(r.instrumentId, m) })
    const ltMap = new Map(latestTicks.map((r)   => [r.instrumentId, r._max.timestamp?.toISOString() ?? null]))
    const lcMap = new Map(latestCandles.map((r) => [r.instrumentId, r._max.timestamp?.toISOString() ?? null]))
    emitIfChanged('progress', instruments.map((inst) => {
      const tm = tcMap.get(inst.id) ?? {}
      const cm = ccMap.get(inst.id) ?? {}
      const tickConfirmed   = tm['CONFIRMED'] ?? 0
      const candleConfirmed = cm['CONFIRMED'] ?? 0
      const startDate = inst.startDate ? new Date(inst.startDate) : new Date('2020-01-01')
      const diffMs = now.getTime() - startDate.getTime()
      const expectedTickHours  = Math.max(1, Math.floor(diffMs / 3_600_000))
      const expectedCandleDays = Math.max(1, Math.floor(diffMs / 86_400_000))
      return {
        instrumentId: inst.id, instrumentName: inst.name, isPause: inst.isPause,
        startDate: inst.startDate?.toISOString() ?? null,
        tickProgress:   Math.min(100, Math.round((tickConfirmed   / expectedTickHours)  * 100)),
        candleProgress: Math.min(100, Math.round((candleConfirmed / expectedCandleDays) * 100)),
        tickConfirmed, candleConfirmed,
        tickTotal:   Object.values(tm).reduce((a, b) => a + b, 0),
        candleTotal: Object.values(cm).reduce((a, b) => a + b, 0),
        expectedTickHours, expectedCandleDays,
        latestTickDate:   ltMap.get(inst.id) ?? null,
        latestCandleDate: lcMap.get(inst.id) ?? null,
      }
    }))
  } catch {}
}

async function pollHeatmap() {
  if (wsClients.size === 0) return
  try {
    const instruments = await prisma.instrument.findMany({
      where: { isActive: true },
      select: { id: true, name: true, isPause: true },
      orderBy: { name: 'asc' },
    })
    const agg = await prisma.state.groupBy({
      by: ['instrumentId', 'jobType', 'status'],
      _count: { id: true },
      where: { isDeleted: false },
    })
    const priority = ['ABANDONED','FAILED','BROKEN','PROCESSED','NOT_FOUND','PENDING','COMPLETED','CONFIRMED']
    const dominant = (rows: typeof agg) => { for (const s of priority) if (rows.some((r) => r.status === s)) return s; return null }
    const sum = (rows: typeof agg, status: string) => rows.filter((r) => r.status === status).reduce((a, r) => a + r._count.id, 0)
    emitIfChanged('heatmap', instruments.map((inst) => {
      const ia = agg.filter((r) => r.instrumentId === inst.id)
      const tr = ia.filter((r) => r.jobType === 'TICK')
      const cr = ia.filter((r) => r.jobType === 'CANDLE')
      return {
        instrumentId: inst.id, instrumentName: inst.name, isPause: inst.isPause,
        tickStatus:   dominant(tr), candleStatus: dominant(cr),
        tickConfirmed:   sum(tr, 'CONFIRMED'),
        tickFailed:      sum(tr, 'FAILED') + sum(tr, 'ABANDONED') + sum(tr, 'BROKEN'),
        candleConfirmed: sum(cr, 'CONFIRMED'),
        candleFailed:    sum(cr, 'FAILED') + sum(cr, 'ABANDONED') + sum(cr, 'BROKEN'),
      }
    }))
  } catch {}
}

async function pollHealth() {
  if (wsClients.size === 0) return
  try {
    const db = await prisma.$queryRaw`SELECT 1`.then(() => 'connected').catch(() => 'disconnected') as string
    if (snapshots.get('health') === db) return
    snapshots.set('health', db)
    broadcast({ type: 'health', data: { database: db, timestamp: new Date().toISOString() } })
  } catch {}
}

async function pollRuntime() {
  if (wsClients.size === 0) return
  const daemonUrl = process.env.GO_DAEMON_URL ?? 'http://192.168.1.8:8080/api/v1'
  try {
    const res = await fetch(`${daemonUrl}/runtime`, { signal: AbortSignal.timeout(3_000) })
    if (!res.ok) return
    const body = await res.json() as { success: boolean; data: unknown }
    if (body.success) broadcast({ type: 'runtime', data: body.data })
  } catch {}
}

async function pollQueues() {
  if (wsClients.size === 0) return
  const mgmtBase = process.env.RABBITMQ_MANAGEMENT_URL ?? 'http://192.168.1.8:15672/api'
  const user = process.env.RABBITMQ_USERNAME ?? 'sans'
  const pass = process.env.RABBITMQ_PASSWORD ?? '!PQssw0rd123'
  const queueNames = ['jobs.ticks.regular','jobs.ticks.backfill','jobs.candles.regular','jobs.candles.backfill','jobs.maintenance','jobs.sync']
  try {
    const auth = Buffer.from(`${user}:${pass}`).toString('base64')
    const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }
    const results = await Promise.all(queueNames.map(async (name) => {
      try {
        const res = await fetch(`${mgmtBase}/queues/${encodeURIComponent('geonera')}/${encodeURIComponent(name)}`, { headers, signal: AbortSignal.timeout(5_000) })
        if (!res.ok) return { name, consumers: 0, messages: 0, state: 'unknown' }
        const q = await res.json() as { consumers: number; messages: number; state: string }
        return { name, consumers: q.consumers ?? 0, messages: q.messages ?? 0, state: q.state ?? 'unknown' }
      } catch { return { name, consumers: -1, messages: -1, state: 'unreachable' } }
    }))
    emitIfChanged('queues', { queues: results, healthy: results.filter((q) => q.consumers > 0).length, total: queueNames.length })
  } catch {}
}

async function pollCrons() {
  if (wsClients.size === 0) return
  try {
    const data = await prisma.cron.findMany({ orderBy: { name: 'asc' } })
    emitIfChanged('crons', data.map((c) => ({ ...c, nextRunAt: getNextRun(c.cronExpr) })))
  } catch {}
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

export function startBroadcasters() {
  setInterval(pollLocks,       1_000)
  setInterval(pollKpis,        3_000)
  setInterval(pollDistribution,3_000)
  setInterval(pollActivity,    3_000)
  setInterval(pollRuntime,     3_000)
  setInterval(pollProgress,    5_000)
  setInterval(pollHeatmap,     5_000)
  setInterval(pollQueues,      5_000)
  setInterval(pollHealth,      5_000)
  setInterval(pollCrons,      10_000)
}
