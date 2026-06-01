import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { sendSuccess, sendError } from '../lib/response'

const instruments = new Hono()

// Custom validation error message handler
const validationHook = (result: any, c: any) => {
  if (!result.success) {
    const errorMsg = result.error.issues
      .map((issue: any) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ')
    return sendError(c, errorMsg, 400)
  }
}

const createSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(20, 'Name must be 20 characters or less').transform((v) => v.toLowerCase().trim()),
  description: z.string().max(200, 'Description must be 200 characters or less').optional(),
  assetClass: z.string().max(50, 'Asset class must be 50 characters or less').optional(),
  divider: z.number().int('Divider must be an integer').positive('Divider must be a positive integer').optional(),
  startDate: z.string().datetime({ offset: true, message: 'Invalid start date format' }).optional(),
  isActive: z.boolean().default(true),
})

const selectFields = {
  id: true,
  name: true,
  description: true,
  assetClass: true,
  isActive: true,
  isPause: true,
  divider: true,
  startDate: true,
}

instruments.get('/', async (c) => {
  try {
    const data = await prisma.instrument.findMany({
      select: selectFields,
      orderBy: { name: 'asc' },
    })
    return sendSuccess(c, data)
  } catch (error) {
    console.error('[instruments/list]', error)
    return sendError(c, 'Failed to fetch instruments', 500)
  }
})

instruments.get('/:id', async (c) => {
  const id = c.req.param('id')
  try {
    const data = await prisma.instrument.findUnique({
      where: { id },
      select: selectFields,
    })
    if (!data) return sendError(c, 'Instrument not found', 404)
    return sendSuccess(c, data)
  } catch (error) {
    console.error(`[instruments/get/${id}]`, error)
    return sendError(c, 'Failed to fetch instrument', 500)
  }
})

instruments.post('/', zValidator('json', createSchema, validationHook), async (c) => {
  const body = c.req.valid('json')
  try {
    const instrument = await prisma.instrument.create({
      data: {
        id: crypto.randomUUID(),
        name: body.name,
        description: body.description ?? null,
        assetClass: body.assetClass ?? null,
        divider: body.divider ?? null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        isActive: body.isActive,
        isPause: false,
      },
      select: selectFields,
    })
    return sendSuccess(c, instrument, 201)
  } catch (err: any) {
    if (err?.code === 'P2002') return sendError(c, 'Instrument name already exists', 409)
    console.error('[instruments/create]', err)
    return sendError(c, 'Failed to create instrument', 500)
  }
})

instruments.patch('/:id/active', async (c) => {
  const id = c.req.param('id')
  try {
    const current = await prisma.instrument.findUnique({ where: { id }, select: { isActive: true } })
    if (!current) return sendError(c, 'Instrument not found', 404)
    const updated = await prisma.instrument.update({
      where: { id },
      data: { isActive: !current.isActive },
      select: selectFields,
    })
    return sendSuccess(c, updated)
  } catch (error) {
    console.error(`[instruments/toggleActive/${id}]`, error)
    return sendError(c, 'Failed to update active state', 500)
  }
})

instruments.patch('/:id/pause', async (c) => {
  const id = c.req.param('id')
  try {
    const current = await prisma.instrument.findUnique({ where: { id }, select: { isPause: true } })
    if (!current) return sendError(c, 'Instrument not found', 404)
    const updated = await prisma.instrument.update({
      where: { id },
      data: { isPause: !current.isPause },
      select: selectFields,
    })
    return sendSuccess(c, updated)
  } catch (error) {
    console.error(`[instruments/togglePause/${id}]`, error)
    return sendError(c, 'Failed to update pause state', 500)
  }
})

export default instruments
