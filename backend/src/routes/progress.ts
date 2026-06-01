import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { sendSuccess, sendError } from '../lib/response'

const progress = new Hono()

progress.get('/', async (c) => {
  try {
    const instruments = await prisma.instrument.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        isPause: true,
        startDate: true,
      },
      orderBy: { name: 'asc' },
    })

    const now = new Date()

    // Optimized: Execute bulk aggregates instead of N+1 loop queries
    const [tickCounts, candleCounts, latestTicks, latestCandles] = await Promise.all([
      prisma.state.groupBy({
        by: ['instrumentId', 'status'],
        where: { jobType: 'TICK', isDeleted: false },
        _count: { id: true },
      }),
      prisma.state.groupBy({
        by: ['instrumentId', 'status'],
        where: { jobType: 'CANDLE', isDeleted: false },
        _count: { id: true },
      }),
      prisma.state.groupBy({
        by: ['instrumentId'],
        where: { jobType: 'TICK', status: 'CONFIRMED', isDeleted: false },
        _max: { timestamp: true },
      }),
      prisma.state.groupBy({
        by: ['instrumentId'],
        where: { jobType: 'CANDLE', status: 'CONFIRMED', isDeleted: false },
        _max: { timestamp: true },
      }),
    ])

    // Group maps by instrumentId for O(1) lookups
    const tickCountsMap = new Map<string, Array<{ status: string; count: number }>>()
    tickCounts.forEach((r) => {
      const arr = tickCountsMap.get(r.instrumentId) ?? []
      arr.push({ status: r.status, count: r._count.id })
      tickCountsMap.set(r.instrumentId, arr)
    })

    const candleCountsMap = new Map<string, Array<{ status: string; count: number }>>()
    candleCounts.forEach((r) => {
      const arr = candleCountsMap.get(r.instrumentId) ?? []
      arr.push({ status: r.status, count: r._count.id })
      candleCountsMap.set(r.instrumentId, arr)
    })

    const latestTickMap = new Map<string, Date>()
    latestTicks.forEach((r) => {
      if (r._max.timestamp) {
        latestTickMap.set(r.instrumentId, r._max.timestamp)
      }
    })

    const latestCandleMap = new Map<string, Date>()
    latestCandles.forEach((r) => {
      if (r._max.timestamp) {
        latestCandleMap.set(r.instrumentId, r._max.timestamp)
      }
    })

    const data = instruments.map((inst) => {
      const ticks = tickCountsMap.get(inst.id) ?? []
      const tm = Object.fromEntries(ticks.map((r) => [r.status, r.count]))

      const candles = candleCountsMap.get(inst.id) ?? []
      const cm = Object.fromEntries(candles.map((r) => [r.status, r.count]))

      const tickConfirmed = tm['CONFIRMED'] ?? 0
      const candleConfirmed = cm['CONFIRMED'] ?? 0
      const tickTotal = Object.values(tm).reduce((a, b) => a + b, 0)
      const candleTotal = Object.values(cm).reduce((a, b) => a + b, 0)

      const startDate = inst.startDate ? new Date(inst.startDate) : new Date('2020-01-01')
      const diffMs = now.getTime() - startDate.getTime()
      const expectedTickHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)))
      const expectedCandleDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

      const latestTickDate = latestTickMap.get(inst.id)?.toISOString() ?? null
      const latestCandleDate = latestCandleMap.get(inst.id)?.toISOString() ?? null

      return {
        instrumentId: inst.id,
        instrumentName: inst.name,
        isPause: inst.isPause,
        startDate: inst.startDate?.toISOString() ?? null,
        tickProgress: Math.min(100, Math.round((tickConfirmed / expectedTickHours) * 100)),
        candleProgress: Math.min(100, Math.round((candleConfirmed / expectedCandleDays) * 100)),
        tickConfirmed,
        tickTotal,
        candleConfirmed,
        candleTotal,
        expectedTickHours,
        expectedCandleDays,
        latestTickDate,
        latestCandleDate,
      }
    })

    return sendSuccess(c, data)
  } catch (error) {
    console.error('[progress]', error)
    return sendError(c, 'Failed to fetch progress', 500)
  }
})

export default progress
