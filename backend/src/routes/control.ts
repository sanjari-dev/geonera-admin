import { Hono } from 'hono'
import { sendSuccess, sendError } from '../lib/response'

const control = new Hono()

const DAEMON_URL = () => process.env.GO_DAEMON_URL ?? 'http://192.168.1.8:8080/api/v1'
import { prisma } from '../lib/prisma'

// Exact Go Fiber routes from internal/api/routes.go
// All return HTTP 202 with { "status": "triggered_via_http" } — no request body required.
type ActionDef = { label: string; path: string; description: string }

const ACTIONS: Record<string, ActionDef> = {
  'ticks/regular':    { label: 'Ticks Regular',    path: '/ticks/regular',    description: 'Regular tick ingestion for T-0 / T-1 / T-2 slots (runs hourly at :05)' },
  'ticks/backfill':   { label: 'Ticks Backfill',   path: '/ticks/backfill',   description: 'Historical tick backfill sweeper (runs every 10 minutes)' },
  'candles/regular':  { label: 'Candles Regular',  path: '/candles/regular',  description: 'Regular candle aggregation for all 19 timeframes (daily at 05:08 UTC)' },
  'candles/backfill': { label: 'Candles Backfill', path: '/candles/backfill', description: 'Historical candle backfill sweeper (runs every 20 minutes)' },
  'maintenance':      { label: 'Maintenance',      path: '/maintenance',      description: 'Auto-Seeder + Gap Fill + Pruning Mark-and-Sweep (runs every ~5 minutes)' },
  'sync':             { label: 'Outbox Sync',      path: '/sync',             description: 'Drain PENDING SyncTask outbox events to recompute resolved_tick_count' },
}

control.get('/actions', (c) => {
  const list = Object.entries(ACTIONS).map(([key, def]) => ({ key, ...def }))
  return sendSuccess(c, list)
})

// ─── Queue Health ──────────────────────────────────────────────────────────────
// Fetches consumer count per worker queue from RabbitMQ Management API.
// Returns 200 with partial data if management API is unreachable (graceful degradation).
control.get('/queues', async (c) => {
  const mgmtBase = process.env.RABBITMQ_MANAGEMENT_URL ?? 'http://192.168.1.8:15672/api'
  const user = process.env.RABBITMQ_USERNAME ?? 'sans'
  const pass = process.env.RABBITMQ_PASSWORD ?? '!PQssw0rd123'
  const vhost = 'geonera'
  const queueNames = [
    'jobs.ticks.regular',
    'jobs.ticks.backfill',
    'jobs.candles.regular',
    'jobs.candles.backfill',
    'jobs.maintenance',
    'jobs.sync',
  ]

  try {
    const encodedVhost = encodeURIComponent(vhost)
    const auth = Buffer.from(`${user}:${pass}`).toString('base64')
    const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }

    const results = await Promise.all(
      queueNames.map(async (name) => {
        try {
          const res = await fetch(
            `${mgmtBase}/queues/${encodedVhost}/${encodeURIComponent(name)}`,
            { headers, signal: AbortSignal.timeout(5_000) }
          )
          if (!res.ok) return { name, consumers: 0, messages: 0, state: 'unknown', error: `HTTP ${res.status}` }
          const q = await res.json() as { consumers: number; messages: number; state: string }
          return { name, consumers: q.consumers ?? 0, messages: q.messages ?? 0, state: q.state ?? 'unknown' }
        } catch (err: any) {
          return { name, consumers: -1, messages: -1, state: 'unreachable', error: err.message }
        }
      })
    )

    const healthy = results.filter((q) => q.consumers > 0).length
    return sendSuccess(c, { queues: results, healthy, total: queueNames.length })
  } catch (err: any) {
    return sendError(c, 'RabbitMQ management unreachable: ' + err.message, 503)
  }
})

// ─── Object Storage Stats ─────────────────────────────────────────────────────
// Proxies to GET /api/v1/storage on the ingestion daemon.
// Returns file counts + byte totals per instrument and job type (cached 5 min).
control.get('/storage', async (c) => {
  try {
    const res = await fetch(`${DAEMON_URL()}/storage`, {
      signal: AbortSignal.timeout(15_000), // first call may take a few seconds
    })
    if (!res.ok) return sendError(c, `Daemon returned HTTP ${res.status}`, 502)
    const data = await res.json()
    return sendSuccess(c, data)
  } catch (err: any) {
    return sendError(c, `Ingestion daemon unreachable: ${err.message}`, 503)
  }
})

// ─── Runtime Metrics ──────────────────────────────────────────────────────────
// Proxies to the Go ingestion daemon's GET /api/v1/runtime endpoint which
// exposes live CPU, heap memory, goroutine count, and uptime for the process.
control.get('/runtime', async (c) => {
  try {
    const res = await fetch(`${DAEMON_URL()}/runtime`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return sendError(c, `Daemon returned HTTP ${res.status}`, 502)
    const data = await res.json()
    return sendSuccess(c, data)
  } catch (err: any) {
    return sendError(c, `Ingestion daemon unreachable: ${err.message}`, 503)
  }
})

control.get('/locks', async (c) => {
  try {
    // Join pg_locks with pg_stat_activity to get:
    //   - lock acquisition time (query_start of the holding transaction)
    //   - state of the backend process
    const locks = await prisma.$queryRaw`
      SELECT
        l.objid::text           AS lock_id,
        l.pid,
        l.mode,
        l.granted,
        a.state                 AS backend_state,
        a.query_start           AS held_since,
        EXTRACT(EPOCH FROM (now() - a.query_start))::int AS held_seconds
      FROM pg_locks l
      LEFT JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE l.locktype = 'advisory'
      ORDER BY a.query_start ASC
    `
    return sendSuccess(c, locks)
  } catch (err: any) {
    return sendError(c, 'Failed to fetch advisory locks: ' + err.message, 500)
  }
})

async function proxy(actionKey: string, c: any) {
  const action = ACTIONS[actionKey]
  if (!action) return sendError(c, 'Unknown action', 404)

  try {
    const res = await fetch(`${DAEMON_URL()}${action.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
    })
    const data = await res.json().catch(() => ({ raw: res.statusText }))
    
    return sendSuccess(c, {
      action: action.label,
      success: res.ok,
      httpStatus: res.status,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error(`[control/proxy/${actionKey}]`, err)
    
    let errorMessage = err.message ?? 'Go Daemon unreachable'
    if (errorMessage.includes('Unable to connect')) {
      errorMessage = `Daemon unreachable at ${DAEMON_URL()}. Is the geonera-ingestion Go service running?`
    }

    return sendError(
      c,
      errorMessage,
      503
    )
  }
}

control.post('/ticks/regular',    (c) => proxy('ticks/regular', c))
control.post('/ticks/backfill',   (c) => proxy('ticks/backfill', c))
control.post('/candles/regular',  (c) => proxy('candles/regular', c))
control.post('/candles/backfill', (c) => proxy('candles/backfill', c))
control.post('/maintenance',      (c) => proxy('maintenance', c))
control.post('/sync',             (c) => proxy('sync', c))

export default control
