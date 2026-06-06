import { createMiddleware } from 'hono/factory'
import { sendError } from '../lib/response'

export const actionSecretMiddleware = createMiddleware(async (c, next) => {
  // Only protect mutation endpoints
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
    const secret = c.req.header('X-Action-Secret')
    const expected = process.env.ADMIN_ACTION_SECRET

    if (expected) {
      if (!secret || secret !== expected) {
        return sendError(c, 'Unauthorized: Invalid Action Secret', 403)
      }
    }
  }
  
  await next()
})
