import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { sendSuccess, sendError } from '../lib/response'

const dashboard = new Hono()

dashboard.get('/kpis', async (c) => {
  try {
    const [totalInstruments, activeInstruments, pausedInstruments, statusCounts] =
      await Promise.all([
        prisma.instrument.count(),
        prisma.instrument.count({ where: { isActive: true } }),
        prisma.instrument.count({ where: { isPause: true } }),
        prisma.state.groupBy({
          by: ['status'],
          _count: { id: true },
          where: { isDeleted: false },
        }),
      ])

    const sm = Object.fromEntries(statusCounts.map((s) => [s.status, s._count.id]))

    return sendSuccess(c, {
      totalInstruments,
      activeInstruments,
      pausedInstruments,
      confirmedStates: sm['CONFIRMED'] ?? 0,
      completedStates: sm['COMPLETED'] ?? 0,
      failedStates: sm['FAILED'] ?? 0,
      abandonedStates: sm['ABANDONED'] ?? 0,
      brokenStates: sm['BROKEN'] ?? 0,
      pendingStates: sm['PENDING'] ?? 0,
      processedStates: sm['PROCESSED'] ?? 0,
      notFoundStates: sm['NOT_FOUND'] ?? 0,
      totalStates: statusCounts.reduce((a, s) => a + s._count.id, 0),
    })
  } catch (error) {
    console.error('[dashboard/kpis]', error)
    return sendError(c, 'Failed to fetch KPIs', 500)
  }
})

dashboard.get('/heatmap', async (c) => {
  try {
    const instruments = await prisma.instrument.findMany({
      where: { isActive: true },
      select: { id: true, name: true, isPause: true },
      orderBy: { name: 'asc' },
    })

    // Aggregate per instrument × job_type
    const agg = await prisma.state.groupBy({
      by: ['instrumentId', 'jobType', 'status'],
      _count: { id: true },
      where: { isDeleted: false },
    })

    const heatmap = instruments.map((inst) => {
      const instAgg = agg.filter((r) => r.instrumentId === inst.id)

      const tickRows = instAgg.filter((r) => r.jobType === 'TICK')
      const candleRows = instAgg.filter((r) => r.jobType === 'CANDLE')

      const dominant = (rows: typeof tickRows) => {
        const priority = ['ABANDONED', 'FAILED', 'BROKEN', 'PROCESSED', 'NOT_FOUND', 'PENDING', 'COMPLETED', 'CONFIRMED']
        for (const s of priority) {
          if (rows.some((r) => r.status === s)) return s
        }
        return null
      }

      const sum = (rows: typeof tickRows, status: string) =>
        rows.filter((r) => r.status === status).reduce((a, r) => a + r._count.id, 0)

      return {
        instrumentId: inst.id,
        instrumentName: inst.name,
        isPause: inst.isPause,
        tickStatus: dominant(tickRows),
        candleStatus: dominant(candleRows),
        tickConfirmed: sum(tickRows, 'CONFIRMED'),
        tickFailed: sum(tickRows, 'FAILED') + sum(tickRows, 'ABANDONED') + sum(tickRows, 'BROKEN'),
        candleConfirmed: sum(candleRows, 'CONFIRMED'),
        candleFailed: sum(candleRows, 'FAILED') + sum(candleRows, 'ABANDONED') + sum(candleRows, 'BROKEN'),
      }
    })

    return sendSuccess(c, heatmap)
  } catch (error) {
    console.error('[dashboard/heatmap]', error)
    return sendError(c, 'Failed to fetch heatmap', 500)
  }
})

// Returns the most recent job trigger events from the activity log.
// Queries ingestion.job_activity_logs directly — no dependency on the Go daemon.
dashboard.get('/activity', async (c) => {
  try {
    const limit = Math.min(Number(c.req.query('limit') ?? 10), 50)
    const rows = await prisma.$queryRaw<{
      id: string
      trigger_src: string
      job_name: string
      triggered_at: Date
      finished_at: Date | null
      duration_ms: bigint | null
      trace_id: string | null
      meta: Record<string, string> | null
    }[]>`
      SELECT id::text, trigger_src, job_name, triggered_at, finished_at,
             duration_ms, trace_id,
             meta
      FROM   ingestion.job_activity_logs
      ORDER  BY (finished_at IS NULL) DESC, triggered_at DESC
      LIMIT  ${limit}
    `
    return sendSuccess(c, rows.map(r => ({
      ...r,
      duration_ms: r.duration_ms != null ? Number(r.duration_ms) : null,
    })))
  } catch (error) {
    console.error('[dashboard/activity]', error)
    return sendError(c, 'Failed to fetch activity log', 500)
  }
})

dashboard.get('/health', async (c) => {
  try {
    const db = await prisma.$queryRaw`SELECT 1`.then(() => 'connected').catch(() => 'disconnected')
    if (db === 'connected') {
      return sendSuccess(c, { database: db, timestamp: new Date().toISOString() })
    } else {
      return sendError(c, 'Database disconnected', 503)
    }
  } catch (error) {
    return sendError(c, 'Database health check failed', 503)
  }
})

export default dashboard
