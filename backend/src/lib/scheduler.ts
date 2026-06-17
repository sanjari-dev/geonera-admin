/**
 * Scheduler utilities for the admin backend.
 *
 * Scheduling is now handled by the standalone geonera-scheduler service.
 * This module provides:
 *   notifyCronReload  — pg_notify to scheduler after any cron CRUD
 *   getNextRun        — pure helper to compute next fire time from a cron expression
 */
import { Cron } from 'croner'
import { prisma } from './prisma'

/**
 * Notify the scheduler service to reload a cron job.
 * Called after every CREATE / UPDATE / DELETE on schedule.crons so the
 * scheduler picks up the change without restarting.
 */
export async function notifyCronReload(id: string): Promise<void> {
  await prisma.$executeRaw`SELECT pg_notify('cron_reload', ${id})`
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
