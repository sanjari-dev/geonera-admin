/**
 * Thin RabbitMQ publisher used by the cron scheduler.
 *
 * Queue names mirror exactly what the Go daemon's consumer.go declares:
 *   jobs.ticks.regular | jobs.ticks.backfill
 *   jobs.candles.regular | jobs.candles.backfill
 *   jobs.maintenance | jobs.sync
 *
 * Message format: empty JSON object `{}` — the Go handlers don't read the body.
 * Durable: true — survives broker restart.
 * PersistentDeliveryMode (2) — survives broker restart.
 */
import amqp from 'amqplib'

// amqplib v0.10.x: connect() returns ChannelModel (not Connection directly)
type RabbitConn = Awaited<ReturnType<typeof amqp.connect>>

// Module-level connection — lazily created and auto-reset on error/close.
let _connection: RabbitConn | null = null

function getRabbitUrl(): string {
  const url = process.env.RABBITMQ_URL
  if (!url) throw new Error('RABBITMQ_URL is not set in environment')
  return url
}

async function getConnection(): Promise<RabbitConn> {
  if (_connection) return _connection

  const conn = await amqp.connect(getRabbitUrl())

  // Reset on any error / graceful close so the next call re-dials.
  ;(conn as any).on('error', (err: Error) => {
    console.error('[rabbitmq] connection error:', err.message)
    _connection = null
  })
  ;(conn as any).on('close', () => {
    console.warn('[rabbitmq] connection closed — will reconnect on next publish')
    _connection = null
  })

  _connection = conn
  return conn
}

/**
 * Publish an empty trigger message to a named queue.
 * Uses a fresh channel per call (cheap) so channel-level errors don't affect
 * the persistent connection.
 */
export async function publishToQueue(
  queueName: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  const conn = await getConnection()
  const channel = await conn.createChannel()

  try {
    // Assert idempotently — matches the Go daemon's QueueDeclare parameters.
    await channel.assertQueue(queueName, { durable: true })

    channel.sendToQueue(
      queueName,
      Buffer.from(JSON.stringify(payload)),
      {
        contentType: 'application/json',
        deliveryMode: 2, // persistent
      }
    )
  } finally {
    await channel.close()
  }
}

/** Gracefully close the AMQP connection on process shutdown. */
export async function closeRabbitMQ(): Promise<void> {
  if (_connection) {
    await (_connection as any).close().catch(() => {})
    _connection = null
  }
}
