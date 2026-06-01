import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { sendSuccess, sendError } from '../lib/response'
import { reloadJob, getNextRun } from '../lib/scheduler'
import { publishToQueue } from '../lib/rabbitmq'

const crons = new Hono()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function withNextRun<T extends { cronExpr: string }>(cron: T) {
  return { ...cron, nextRunAt: getNextRun(cron.cronExpr) }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/** GET /api/crons — list all cron jobs with computed next-run time */
crons.get('/', async (c) => {
  try {
    const data = await prisma.cron.findMany({ orderBy: { name: 'asc' } })
    return sendSuccess(c, data.map(withNextRun))
  } catch (err: any) {
    console.error('[crons/list]', err)
    return sendError(c, 'Failed to fetch cron jobs')
  }
})

/** GET /api/crons/:id */
crons.get('/:id', async (c) => {
  const id = c.req.param('id')
  try {
    const cron = await prisma.cron.findUnique({ where: { id } })
    if (!cron) return sendError(c, 'Cron job not found', 404)
    return sendSuccess(c, withNextRun(cron))
  } catch (err: any) {
    return sendError(c, 'Failed to fetch cron job')
  }
})

const createSchema = z.object({
  name: z.string().min(2).max(60).transform((v) => v.toLowerCase().trim().replace(/\s+/g, '-')),
  description: z.string().max(300).optional(),
  cronExpr: z.string().min(9),   // e.g. "*/5 * * * *"
  workerKey: z.string().min(1),  // e.g. "ticks/regular"
  triggerMethod: z.enum(['RABBITMQ', 'HTTP']).default('RABBITMQ'),
  queueName: z.string().optional(),
  httpPath: z.string().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'INACTIVE']).default('ACTIVE'),
})

/** POST /api/crons — create a new cron job */
crons.post('/', zValidator('json', createSchema), async (c) => {
  const body = c.req.valid('json')
  try {
    const cron = await prisma.cron.create({
      data: {
        id: crypto.randomUUID(),
        name: body.name,
        description: body.description ?? null,
        cronExpr: body.cronExpr,
        workerKey: body.workerKey,
        triggerMethod: body.triggerMethod,
        queueName: body.queueName ?? null,
        httpPath: body.httpPath ?? null,
        status: body.status,
        updatedAt: new Date(),
      },
    })
    // Start the scheduler job immediately if ACTIVE
    await reloadJob(cron.id)
    return sendSuccess(c, withNextRun(cron), 201)
  } catch (err: any) {
    if (err?.code === 'P2002') return sendError(c, `Cron name "${body.name}" already exists`, 409)
    console.error('[crons/create]', err)
    return sendError(c, 'Failed to create cron job')
  }
})

const updateSchema = z.object({
  description: z.string().max(300).optional(),
  cronExpr: z.string().min(9).optional(),
  workerKey: z.string().optional(),
  triggerMethod: z.enum(['RABBITMQ', 'HTTP']).optional(),
  queueName: z.string().nullable().optional(),
  httpPath: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'INACTIVE']).optional(),
})

/** PATCH /api/crons/:id — update cron fields */
crons.patch('/:id', zValidator('json', updateSchema), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  try {
    const existing = await prisma.cron.findUnique({ where: { id } })
    if (!existing) return sendError(c, 'Cron job not found', 404)

    const updated = await prisma.cron.update({
      where: { id },
      data: { ...body, updatedAt: new Date() },
    })
    // Reload the scheduler with the new settings
    await reloadJob(id)
    return sendSuccess(c, withNextRun(updated))
  } catch (err: any) {
    console.error('[crons/update]', err)
    return sendError(c, 'Failed to update cron job')
  }
})

/** PATCH /api/crons/:id/status — toggle ACTIVE ↔ PAUSED */
crons.patch('/:id/status', async (c) => {
  const id = c.req.param('id')
  try {
    const current = await prisma.cron.findUnique({ where: { id } })
    if (!current) return sendError(c, 'Cron job not found', 404)

    const next = current.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    const updated = await prisma.cron.update({
      where: { id },
      data: { status: next, updatedAt: new Date() },
    })
    await reloadJob(id)
    return sendSuccess(c, withNextRun(updated))
  } catch (err: any) {
    console.error('[crons/status]', err)
    return sendError(c, 'Failed to toggle cron status')
  }
})

/** DELETE /api/crons/:id — remove a cron job */
crons.delete('/:id', async (c) => {
  const id = c.req.param('id')
  try {
    const existing = await prisma.cron.findUnique({ where: { id } })
    if (!existing) return sendError(c, 'Cron job not found', 404)

    // Stop the scheduler job first
    await reloadJob(id) // this will stop it since it won't find an active cron

    await prisma.cron.delete({ where: { id } })
    return sendSuccess(c, { deleted: id })
  } catch (err: any) {
    console.error('[crons/delete]', err)
    return sendError(c, 'Failed to delete cron job')
  }
})

/** POST /api/crons/:id/trigger — manually fire a cron immediately */
crons.post('/:id/trigger', async (c) => {
  const id = c.req.param('id')
  try {
    const cron = await prisma.cron.findUnique({ where: { id } })
    if (!cron) return sendError(c, 'Cron job not found', 404)

    const t0 = Date.now()
    let success = false
    let resultMeta: Record<string, unknown> = {}

    if (cron.triggerMethod === 'RABBITMQ' && cron.queueName) {
      await publishToQueue(cron.queueName, {})
      success = true
      resultMeta = { method: 'rabbitmq', queue: cron.queueName }
    } else if (cron.httpPath) {
      const url = `${process.env.GO_DAEMON_URL ?? 'http://192.168.1.8:8080/api/v1'}${cron.httpPath}`
      const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(15_000) })
      success = res.ok
      resultMeta = { method: 'http', httpStatus: res.status, path: cron.httpPath }
    } else {
      return sendError(c, 'Cron has no queue_name or http_path configured', 400)
    }

    const result = { success, durationMs: Date.now() - t0, triggeredAt: new Date().toISOString(), ...resultMeta }

    // Persist the manual trigger result
    await prisma.cron.update({
      where: { id },
      data: { lastTriggeredAt: new Date(), lastResult: result, updatedAt: new Date() },
    })

    return sendSuccess(c, result)
  } catch (err: any) {
    console.error('[crons/trigger]', err)
    return sendError(c, err.message ?? 'Trigger failed — Go Daemon or RabbitMQ unreachable', 503)
  }
})

export default crons
