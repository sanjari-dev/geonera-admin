/**
 * Auto-migration for dashboard-owned tables.
 * Runs on every backend startup (idempotent — uses IF NOT EXISTS + ON CONFLICT).
 *
 * WHY VARCHAR not PostgreSQL ENUM:
 * Prisma's String type maps to VARCHAR/TEXT. If a column is stored as a native
 * PostgreSQL enum type (e.g. schedule.cron_trigger_enum), Prisma throws
 * P2032 "Error converting field … found incompatible value".
 * Using VARCHAR avoids this and still lets application code validate values.
 *
 * IMPORTANT: Only manages the `schedule` schema.
 * Never touch `master` or `ingestion` — those are owned by Go ent.
 */
import { prisma } from './prisma'

// Each string is a separate statement (prisma.$executeRawUnsafe runs one at a time)
const STEPS: string[] = [
  // ── Schema ────────────────────────────────────────────────────────────────
  `CREATE SCHEMA IF NOT EXISTS schedule`,

  // ── Table (VARCHAR — not PostgreSQL native enums) ─────────────────────────
  `CREATE TABLE IF NOT EXISTS schedule.crons (
    id                UUID         NOT NULL DEFAULT gen_random_uuid(),
    name              VARCHAR      NOT NULL,
    description       TEXT,
    cron_expr         VARCHAR      NOT NULL,
    worker_key        VARCHAR      NOT NULL,
    trigger_method    VARCHAR      NOT NULL DEFAULT 'RABBITMQ',
    queue_name        VARCHAR,
    http_path         VARCHAR,
    status            VARCHAR      NOT NULL DEFAULT 'ACTIVE',
    last_triggered_at TIMESTAMPTZ,
    last_result       JSONB,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT crons_pkey     PRIMARY KEY (id),
    CONSTRAINT crons_name_key UNIQUE (name)
  )`,

  // ── Migrate existing installations that used native enum types ────────────
  // If trigger_method / status were previously created as enum, cast them to VARCHAR.
  `DO $$ BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'schedule' AND table_name = 'crons'
        AND column_name = 'trigger_method'
        AND data_type = 'USER-DEFINED'
    ) THEN
      ALTER TABLE schedule.crons
        ALTER COLUMN trigger_method TYPE VARCHAR USING trigger_method::VARCHAR,
        ALTER COLUMN status         TYPE VARCHAR USING status::VARCHAR;
    END IF;
  END $$`,

  // ── Settings table (key-value store for runtime configuration) ────────────
  `CREATE TABLE IF NOT EXISTS schedule.settings (
    key   VARCHAR NOT NULL,
    value TEXT    NOT NULL,
    CONSTRAINT settings_pkey PRIMARY KEY (key)
  )`,

  `INSERT INTO schedule.settings (key, value)
   VALUES ('worker_auto_run', 'true')
   ON CONFLICT (key) DO NOTHING`,

  // ── Seed — 6 workers, mod-5 staggered, no two fire at the same minute ────
  //  :00,:05,:10...  Maintenance
  //  :01,:06,:11...  Outbox Sync
  //  :02             Ticks Regular (hourly)
  //  :03,:13,:23...  Ticks Backfill (every 10 min)
  //  :04,:24,:44     Candles Backfill (every 20 min)
  //  05:08 UTC       Candles Regular (daily)
  `INSERT INTO schedule.crons
     (name, description, cron_expr, worker_key, trigger_method, queue_name, http_path, status)
   VALUES
     ('maintenance',
      'Auto-Seeder + Gap Fill + Pruning Mark-and-Sweep. Slot :00 every 5 min.',
      '*/5 * * * *', 'maintenance', 'RABBITMQ', 'jobs.maintenance', '/maintenance', 'ACTIVE'),
     ('sync',
      'Drain PENDING SyncTask outbox events to recompute resolved_tick_count. Slot :01 every 5 min.',
      '1,6,11,16,21,26,31,36,41,46,51,56 * * * *', 'sync', 'RABBITMQ', 'jobs.sync', '/sync', 'ACTIVE'),
     ('ticks-regular',
      'Regular tick ingestion for T-0/T-1/T-2 hourly slots. Fires once per hour at :02.',
      '2 * * * *', 'ticks/regular', 'RABBITMQ', 'jobs.ticks.regular', '/ticks/regular', 'ACTIVE'),
     ('ticks-backfill',
      'Historical tick backfill sweeper. Slot :03 every 10 min.',
      '3,13,23,33,43,53 * * * *', 'ticks/backfill', 'RABBITMQ', 'jobs.ticks.backfill', '/ticks/backfill', 'ACTIVE'),
     ('candles-backfill',
      'Historical candle backfill sweeper. Slot :04 every 20 min.',
      '4,24,44 * * * *', 'candles/backfill', 'RABBITMQ', 'jobs.candles.backfill', '/candles/backfill', 'ACTIVE'),
     ('candles-regular',
      'Daily candle aggregation for all 19 timeframes. Fires once daily at 05:08 UTC.',
      '8 5 * * *', 'candles/regular', 'RABBITMQ', 'jobs.candles.regular', '/candles/regular', 'ACTIVE')
   ON CONFLICT (name) DO NOTHING`,
]

export async function runMigrations(): Promise<void> {
  console.log('🔧 Running dashboard auto-migrations...')
  for (const sql of STEPS) {
    await prisma.$executeRawUnsafe(sql)
  }
  console.log('✅ schedule.crons table ready')
}
