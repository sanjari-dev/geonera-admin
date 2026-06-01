import type { Context } from 'hono'
import { sendError } from '../lib/response'

export function globalErrorHandler(err: Error, c: Context) {
  console.error(`[Unhandled Error] [${c.req.method} ${c.req.path}]:`, err)

  // Standardize error responses. Do not leak internal details/stack traces in production.
  const isDev = process.env.NODE_ENV === 'development'
  const message = isDev ? err.message : 'Internal Server Error'

  return sendError(c, message, 500)
}
