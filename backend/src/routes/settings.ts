import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { sendSuccess, sendError } from '../lib/response'

const settings = new Hono()

/** GET /api/settings/worker-auto-run — read current state from DB */
settings.get('/worker-auto-run', async (c) => {
  try {
    const rows = await prisma.$queryRaw<{ value: string }[]>`
      SELECT value FROM schedule.settings WHERE key = 'worker_auto_run'
    `
    return sendSuccess(c, { enabled: rows.length > 0 ? rows[0].value === 'true' : true })
  } catch (err: any) {
    console.error('[settings/worker-auto-run/get]', err)
    return sendError(c, 'Failed to read worker auto-run setting')
  }
})

/** PATCH /api/settings/worker-auto-run — persist to DB and notify scheduler */
settings.patch('/worker-auto-run', zValidator('json', z.object({ enabled: z.boolean() })), async (c) => {
  const { enabled } = c.req.valid('json')
  try {
    await prisma.$executeRaw`
      UPDATE schedule.settings SET value = ${enabled ? 'true' : 'false'}
      WHERE key = 'worker_auto_run'
    `
    // Notify the scheduler service to refresh its in-memory auto-run flag
    await prisma.$executeRaw`SELECT pg_notify('scheduler_settings', 'worker_auto_run')`
    return sendSuccess(c, { enabled })
  } catch (err: any) {
    console.error('[settings/worker-auto-run/patch]', err)
    return sendError(c, 'Failed to update worker auto-run setting')
  }
})

export default settings
