import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { sendSuccess, sendError } from '../lib/response'

const states = new Hono()

states.get('/distribution', async (c) => {
  try {
    const rows = await prisma.state.groupBy({
      by: ['status', 'jobType'],
      _count: { id: true },
      where: { isDeleted: false },
      orderBy: { _count: { id: 'desc' } },
    })
    const formatted = rows.map((r) => ({
      status: r.status,
      jobType: r.jobType,
      count: r._count.id,
    }))
    return sendSuccess(c, formatted)
  } catch (error) {
    console.error('[states/distribution]', error)
    return sendError(c, 'Failed to fetch distribution', 500)
  }
})

states.get('/recent', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1'))
  const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') ?? '50')))
  const status = c.req.query('status')
  const jobType = c.req.query('jobType')
  const instrumentId = c.req.query('instrumentId')
  const minRetry  = parseInt(c.req.query('minRetry')  ?? '0')
  const minStreak = parseInt(c.req.query('minStreak') ?? '0')
  const isHoliday = c.req.query('isHoliday')           // 'true' | 'false' | undefined

  const VALID_STATUSES = new Set(['PENDING', 'PROCESSED', 'NOT_FOUND', 'FAILED', 'COMPLETED', 'BROKEN', 'CONFIRMED', 'ABANDONED'])
  const VALID_JOB_TYPES = new Set(['TICK', 'CANDLE'])
  if (status  && !VALID_STATUSES.has(status))   return sendError(c, `Invalid status: "${status}"`, 400)
  if (jobType && !VALID_JOB_TYPES.has(jobType)) return sendError(c, `Invalid jobType: "${jobType}"`, 400)

  const where: Record<string, unknown> = { isDeleted: false }
  if (status)       where.status      = status
  if (jobType)      where.jobType     = jobType
  if (instrumentId) where.instrumentId = instrumentId
  if (minRetry  > 0) where.retryCount      = { gte: minRetry }
  if (minStreak > 0) where.notFoundStreak  = { gte: minStreak }
  if (isHoliday === 'true')  where.isHoliday = true
  if (isHoliday === 'false') where.isHoliday = false

  try {
    const [data, total] = await Promise.all([
      prisma.state.findMany({
        where,
        select: {
          id: true,
          instrumentId: true,
          jobType: true,
          timestamp: true,
          status: true,
          previousStatus: true,
          isHoliday: true,
          resolvedTickCount: true,
          retryCount: true,
          notFoundStreak: true,
          isDeleted: true,
          updatedAt: true,
          traceId: true,
          instrument: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.state.count({ where }),
    ])
    return sendSuccess(c, { data, total, page, limit, pages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[states/recent]', error)
    return sendError(c, 'Failed to fetch states', 500)
  }
})

export default states
