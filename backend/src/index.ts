import { createHash, randomBytes } from 'crypto'
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
import settings from './routes/settings'
import { globalErrorHandler } from './middleware/errorHandler'
import { actionSecretMiddleware } from './middleware/auth'
import { sendSuccess } from './lib/response'
import { runMigrations } from './lib/migrate'
import { startScheduler, stopScheduler } from './lib/scheduler'
import { closeRabbitMQ, subscribeToEvents } from './lib/rabbitmq'
import { wsClients, startBroadcasters, scheduleBroadcast, triggerBroadcast } from './lib/broadcaster'

// ── Action Secret bootstrap ───────────────────────────────────────────────────
// If ADMIN_ACTION_SECRET is not provided via .env, generate a one-time SHA1
// secret from 32 cryptographically-random bytes for this session. The generated
// value is printed to the console so the operator can copy it into .env to make
// it persistent across restarts.
if (!process.env.ADMIN_ACTION_SECRET) {
  const generated = createHash('sha1').update(randomBytes(32)).digest('hex')
  process.env.ADMIN_ACTION_SECRET = generated
  console.log('\x1b[33m⚠\x1b[0m  ADMIN_ACTION_SECRET not set — auto-generated for this session:')
  console.log(`\x1b[33m   X-Action-Secret: ${generated}\x1b[0m`)
  console.log('\x1b[2m   Add ADMIN_ACTION_SECRET=' + generated + ' to .env to make it persistent.\x1b[0m')
}

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
    allowHeaders: ['Content-Type', 'X-Action-Secret'],
  })
)

app.use('*', logger())
app.use('/api/*', actionSecretMiddleware)

app.route('/api/dashboard', dashboard)
app.route('/api/instruments', instruments)
app.route('/api/timeframes', timeframes)
app.route('/api/states', states)
app.route('/api/progress', progress)
app.route('/api/control', control)
app.route('/api/crons', crons)
app.route('/api/settings', settings)

app.get('/health', (c) => sendSuccess(c, { status: 'ok', timestamp: new Date().toISOString() }))

// WebSocket clients are managed in lib/broadcaster.ts (re-exported here for the WS handler)

app.get(
  '/ws',
  upgradeWebSocket(() => ({
    onOpen(_evt, ws) {
      wsClients.add(ws)
      ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }))
      // Push fresh data to the newly connected client so it doesn't wait up
      // to 60 s for the next scheduled broadcast cycle.
      triggerBroadcast()
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

    // 3. Start WebSocket broadcasters (push live data to all connected clients)
    startBroadcasters()

    // 4. Subscribe to ingestion state-change events — triggers debounced broadcast
    //    instead of hammering the DB on a fixed interval. Self-healing on drop.
    await subscribeToEvents(scheduleBroadcast)
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
