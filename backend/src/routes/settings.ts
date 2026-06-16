import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getAutoRun, setAutoRun } from '../lib/scheduler'
import { sendSuccess, sendError } from '../lib/response'

const settings = new Hono()

/** GET /api/settings/worker-auto-run — return current global auto-run state */
settings.get('/worker-auto-run', (c) => {
  return sendSuccess(c, { enabled: getAutoRun() })
})

/** PATCH /api/settings/worker-auto-run — toggle automatic worker scheduling on/off */
settings.patch('/worker-auto-run', zValidator('json', z.object({ enabled: z.boolean() })), async (c) => {
  const { enabled } = c.req.valid('json')
  try {
    await setAutoRun(enabled)
    return sendSuccess(c, { enabled })
  } catch (err: any) {
    console.error('[settings/worker-auto-run]', err)
    return sendError(c, 'Failed to update worker auto-run setting')
  }
})

export default settings
