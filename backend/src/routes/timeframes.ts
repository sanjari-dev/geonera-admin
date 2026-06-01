import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { sendSuccess, sendError } from '../lib/response'

const timeframes = new Hono()

timeframes.get('/', async (c) => {
  try {
    const data = await prisma.timeframe.findMany({
      orderBy: { minutes: 'asc' },
    })
    return sendSuccess(c, data)
  } catch (error) {
    console.error('[timeframes/list]', error)
    return sendError(c, 'Failed to fetch timeframes', 500)
  }
})

timeframes.patch('/:id/active', async (c) => {
  const id = c.req.param('id')
  try {
    const current = await prisma.timeframe.findUnique({ where: { id }, select: { isActive: true } })
    if (!current) return sendError(c, 'Timeframe not found', 404)
    const updated = await prisma.timeframe.update({
      where: { id },
      data: { isActive: !current.isActive },
    })
    return sendSuccess(c, updated)
  } catch (error) {
    console.error(`[timeframes/toggleActive/${id}]`, error)
    return sendError(c, 'Failed to update timeframe active state', 500)
  }
})

export default timeframes
