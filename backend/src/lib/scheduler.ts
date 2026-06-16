/**
 * In-process cron scheduler.
 *
 * On startup: loads all ACTIVE crons from schedule.crons, schedules them
 * using croner (UTC timezone).  When a job fires, it publishes to RabbitMQ
 * (primary) or falls back to HTTP POST to the Go Daemon.
 *
 * The scheduler is hot-reloadable: call reloadJob(id) after any CRUD change
 * to immediately apply the new expression / status without restart.
 */
import { Cron } from 'croner'
import { prisma } from './prisma'
import { publishToQueue } from './rabbitmq'
import { daemonFetch } from './daemon'

interface CronRow {
  id: string
  name: string
  cronExpr: string
  workerKey: string
  triggerMethod: string
  queueName: string | null
  httpPath: string | null
}

const jobs = new Map<string, Cron>()

// In-memory cache for the global auto-run flag (persisted to schedule.settings)
let _autoRun = true

// ─── Public API ──────────────────────────────────────────────────────────────

/** Return current global auto-run state. */
export function getAutoRun(): boolean {
  return _autoRun
}

/** Persist the auto-run flag to DB and update the in-memory cache. */
export async function setAutoRun(enabled: boolean): Promise<void> {
  _autoRun = enabled
  await prisma.$executeRaw`
    UPDATE schedule.settings SET value = ${enabled ? 'true' : 'false'}
    WHERE key = 'worker_auto_run'
  `
  console.log(`⏰ Worker auto-run ${enabled ? 'ENABLED' : 'DISABLED'}`)
}

/** Load the auto-run setting from DB (called once at startup). */
async function _loadAutoRun(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<{ value: string }[]>`
      SELECT value FROM schedule.settings WHERE key = 'worker_auto_run'
    `
    if (rows.length > 0) _autoRun = rows[0].value === 'true'
  } catch (err: any) {
    console.warn('⏰ Could not load worker_auto_run setting, defaulting to enabled:', err.message)
  }
}

/** Load all ACTIVE crons and start their schedules. Called once at startup. */
export async function startScheduler(): Promise<void> {
  await _loadAutoRun()

  const crons = await prisma.cron.findMany({ where: { status: 'ACTIVE' } })

  for (const cron of crons) {
    _scheduleOne(cron)
  }

  console.log(`⏰ Scheduler started — ${crons.length} active jobs (auto-run: ${_autoRun ? 'ON' : 'OFF'})`)
}

/**
 * Reload a single cron by id (e.g. after a PATCH from the API).
 * Stops the old job (if any) and starts a new one if status is ACTIVE.
 */
export async function reloadJob(id: string): Promise<void> {
  _stopOne(id)

  const cron = await prisma.cron.findUnique({ where: { id } })
  if (!cron) return

  if (cron.status === 'ACTIVE') {
    _scheduleOne(cron)
    console.log(`⏰ Reloaded job "${cron.name}" (${cron.cronExpr})`)
  } else {
    console.log(`⏰ Job "${cron.name}" is ${cron.status} — not scheduled`)
  }
}

/** Stop all running jobs (called on graceful shutdown). */
export function stopScheduler(): void {
  for (const [id] of jobs) _stopOne(id)
  console.log('⏰ Scheduler stopped')
}

/** Return a status snapshot for the health endpoint. */
export function schedulerStatus(): { total: number; running: number; jobs: { id: string; name: string; nextRun: string | null }[] } {
  const list: { id: string; name: string; nextRun: string | null }[] = []
  for (const [id, job] of jobs) {
    const next = job.nextRun()
    list.push({ id, name: id, nextRun: next ? next.toISOString() : null })
  }
  return { total: list.length, running: list.filter((j) => j.nextRun !== null).length, jobs: list }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function _scheduleOne(cron: CronRow): void {
  _stopOne(cron.id) // idempotent

  try {
    const job = new Cron(
      cron.cronExpr,
      {
        timezone: 'UTC',
        protect: true, // prevent overlap if handler takes longer than the interval
      },
      () => void _fire(cron)
    )
    jobs.set(cron.id, job)
  } catch (err: any) {
    console.error(`⏰ Failed to schedule "${cron.name}" (${cron.cronExpr}):`, err.message)
  }
}

function _stopOne(id: string): void {
  const existing = jobs.get(id)
  if (existing) {
    existing.stop()
    jobs.delete(id)
  }
}

async function _fire(cron: CronRow): Promise<void> {
  if (!_autoRun) {
    console.log(`⏰ [${cron.name}] SKIPPED — worker auto-run is disabled`)
    return
  }

  const t0 = Date.now()
  let success = false
  let resultMeta: Record<string, unknown> = {}

  try {
    if (cron.triggerMethod === 'RABBITMQ' && cron.queueName) {
      // ── Primary: publish to RabbitMQ ────────────────────────────────────
      await publishToQueue(cron.queueName, {})
      success = true
      resultMeta = { method: 'rabbitmq', queue: cron.queueName }
      console.log(`⏰ [${cron.name}] → ${cron.queueName} ✓`)
    } else if (cron.httpPath) {
      // ── Fallback: HTTP POST to Go Daemon ─────────────────────────────
      const res = await daemonFetch(cron.httpPath, {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
      })
      success = res.ok
      resultMeta = { method: 'http', httpStatus: res.status, path: cron.httpPath }
      console.log(`⏰ [${cron.name}] HTTP ${res.status}`)
    } else {
      throw new Error('No queue_name or http_path configured')
    }
  } catch (err: any) {
    resultMeta = { error: err.message, method: cron.triggerMethod }
    console.error(`⏰ [${cron.name}] FAILED:`, err.message)
  }

  // Persist last run metadata (non-blocking — fire and forget)
  prisma.cron
    .update({
      where: { id: cron.id },
      data: {
        lastTriggeredAt: new Date(),
        lastResult: { success, durationMs: Date.now() - t0, ...resultMeta },
        updatedAt: new Date(),
      },
    })
    .catch((e) => console.error(`⏰ [${cron.name}] Failed to persist last_result:`, e.message))
}

/** Compute next run time for a cron expression without starting a job. */
export function getNextRun(cronExpr: string): string | null {
  try {
    const job = new Cron(cronExpr, { timezone: 'UTC' })
    const next = job.nextRun()
    job.stop()
    return next ? next.toISOString() : null
  } catch {
    return null
  }
}
