import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createBunWebSocket } from 'hono/bun'
import type { ServerWebSocket } from 'bun'

import dashboard from './routes/dashboard'
import instruments from './routes/instruments'
import timeframes from './routes/timeframes'
import states from './routes/states'
import progress from './routes/progress'
import control from './routes/control'
import crons from './routes/crons'
import { globalErrorHandler } from './middleware/errorHandler'
import { sendSuccess } from './lib/response'
import { runMigrations } from './lib/migrate'
import { startScheduler, stopScheduler } from './lib/scheduler'
import { closeRabbitMQ } from './lib/rabbitmq'

const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>()

const app = new Hono()

app.onError(globalErrorHandler)

const corsOrigins: string | string[] = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS === '*'
    ? '*'
    : process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:5174']

app.use(
  '*',
  cors({
    origin: corsOrigins,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })
)

app.use('*', logger())

app.route('/api/dashboard', dashboard)
app.route('/api/instruments', instruments)
app.route('/api/timeframes', timeframes)
app.route('/api/states', states)
app.route('/api/progress', progress)
app.route('/api/control', control)
app.route('/api/crons', crons)

app.get('/health', (c) => sendSuccess(c, { status: 'ok', timestamp: new Date().toISOString() }))

// WebSocket — clients connect for real-time connection status ping/pong
const wsClients = new Set<any>()

app.get(
  '/ws',
  upgradeWebSocket(() => ({
    onOpen(_evt, ws) {
      wsClients.add(ws)
      ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }))
    },
    onClose(_evt, ws) {
      wsClients.delete(ws)
    },
    onMessage(evt, ws) {
      if (evt.data === 'ping') ws.send('pong')
    },
  }))
)

const port = parseInt(process.env.PORT ?? '3001')

// ── Bootstrap sequence (runs after Bun starts serving) ───────────────────────
async function bootstrap() {
  try {
    // 1. Ensure schedule.crons table exists (idempotent, safe on every restart)
    await runMigrations()

    // 2. Start the in-process cron scheduler
    await startScheduler()
  } catch (err: any) {
    console.error('⚠️  Bootstrap error (non-fatal):', err.message)
    // Don't crash the server — DB/MQ might become available later
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  stopScheduler()
  await closeRabbitMQ()
  process.exit(0)
})

process.on('SIGINT', async () => {
  stopScheduler()
  await closeRabbitMQ()
  process.exit(0)
})

// Defer bootstrap so the HTTP server is already accepting requests
setTimeout(bootstrap, 500)

export default { port, fetch: app.fetch, websocket }

console.log(`\x1b[32m✓\x1b[0m Geonera Admin API → http://localhost:${port}`)
