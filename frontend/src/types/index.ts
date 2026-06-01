export type JobType = 'TICK' | 'CANDLE'

export type StateStatus =
  | 'PENDING'
  | 'PROCESSED'
  | 'NOT_FOUND'
  | 'FAILED'
  | 'COMPLETED'
  | 'BROKEN'
  | 'CONFIRMED'
  | 'ABANDONED'

export type SyncTaskStatus = 'PENDING' | 'PROCESSED'

// Mirrors master.instruments (nullable fields match the ent schema / init.sql)
export interface Instrument {
  id: string
  name: string
  description: string | null
  assetClass: string | null
  isActive: boolean
  isPause: boolean
  divider: number | null
  startDate: string | null
}

// Mirrors master.timeframes
export interface Timeframe {
  id: string
  name: string
  minutes: number
  isActive: boolean
}

export interface State {
  id: string
  instrumentId: string
  jobType: JobType
  timestamp: string
  status: StateStatus
  previousStatus?: StateStatus | null
  isHoliday: boolean
  resolvedTickCount: number
  retryCount: number
  notFoundStreak: number
  isDeleted: boolean
  updatedAt: string
  instrument?: Pick<Instrument, 'name'>
}

export interface SyncTask {
  id: string
  instrumentId: string
  targetDate: string
  status: SyncTaskStatus
  createdAt: string
}

// ─── API response shapes ────────────────────────────────────────────────────

export interface KpiStats {
  totalInstruments: number
  activeInstruments: number
  pausedInstruments: number
  confirmedStates: number
  completedStates: number
  failedStates: number
  abandonedStates: number
  brokenStates: number
  pendingStates: number
  processedStates: number
  notFoundStates: number
  totalStates: number
}

export interface HeatmapEntry {
  instrumentId: string
  instrumentName: string
  isPause: boolean
  tickStatus: StateStatus | null
  candleStatus: StateStatus | null
  tickConfirmed: number
  tickFailed: number
  candleConfirmed: number
  candleFailed: number
}

export interface StateDistribution {
  status: StateStatus
  jobType: JobType
  count: number
}

export interface ProgressEntry {
  instrumentId: string
  instrumentName: string
  isPause: boolean
  startDate: string | null
  tickProgress: number
  candleProgress: number
  tickConfirmed: number
  tickTotal: number
  candleConfirmed: number
  candleTotal: number
  expectedTickHours: number
  expectedCandleDays: number
  latestTickDate: string | null
  latestCandleDate: string | null
}

export interface StatesPage {
  data: State[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface ControlResult {
  action: string
  success: boolean
  httpStatus?: number
  data?: unknown
  error?: string
  timestamp: string
}

export interface ActionDef {
  key: string
  label: string
  path: string
  description: string
}

export interface SystemHealth {
  database: 'connected' | 'disconnected'
  timestamp: string
}

// ─── Cron Job Management ─────────────────────────────────────────────────────

export type CronStatus = 'ACTIVE' | 'PAUSED' | 'INACTIVE'
export type CronTriggerMethod = 'RABBITMQ' | 'HTTP'

export interface Cron {
  id: string
  name: string
  description: string | null
  cronExpr: string
  workerKey: string
  triggerMethod: CronTriggerMethod
  queueName: string | null
  httpPath: string | null
  status: CronStatus
  lastTriggeredAt: string | null
  lastResult: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  nextRunAt: string | null   // computed by backend via croner
}

export interface CronTriggerResult {
  success: boolean
  durationMs: number
  triggeredAt: string
  method: CronTriggerMethod
  queue?: string
  httpStatus?: number
  path?: string
  error?: string
}
