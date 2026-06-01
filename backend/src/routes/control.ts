import { Hono } from 'hono'
import { sendSuccess, sendError } from '../lib/response'

const control = new Hono()

const DAEMON_URL = () => process.env.GO_DAEMON_URL ?? 'http://192.168.1.8:8080/api/v1'

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
