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
import { globalErrorHandler } from './middleware/errorHandler'
import { sendSuccess } from './lib/response'

const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>()

const app = new Hono()

// Apply error handler
app.onError(globalErrorHandler)

app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
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

export default { port, fetch: app.fetch, websocket }

console.log(`\x1b[32m✓\x1b[0m Geonera Admin API → http://localhost:${port}`)
