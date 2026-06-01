import type { Context } from 'hono'

export interface StandardResponse<T = any> {
  success: boolean
  data: T | null
  error: string | null
}

export function sendSuccess<T>(c: Context, data: T, status: number = 200) {
  return c.json(
    {
      success: true,
      data,
      error: null,
    },
    status as any
  )
}

export function sendError(c: Context, message: string, status: number = 500) {
  return c.json(
    {
      success: false,
      data: null,
      error: message,
    },
    status as any
  )
}
