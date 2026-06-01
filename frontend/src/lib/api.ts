import type {
  ActionDef,
  ControlResult,
  HeatmapEntry,
  Instrument,
  KpiStats,
  ProgressEntry,
  StateDistribution,
  StatesPage,
  SystemHealth,
  Timeframe,
} from '@/types'

const BASE = '/api'

interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  const body = (await res.json().catch(() => ({ success: false, data: null, error: 'Failed to parse JSON' }))) as ApiResponse<T>
  
  if (!res.ok || !body.success) {
    throw new Error(body.error ?? `GET ${path} → ${res.status}`)
  }
  return body.data as T
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  
  const payload = (await res.json().catch(() => ({ success: false, data: null, error: 'Failed to parse JSON' }))) as ApiResponse<T>

  if (!res.ok || !payload.success) {
    throw new Error(payload.error ?? `POST ${path} → ${res.status}`)
  }
  return payload.data as T
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  
  const payload = (await res.json().catch(() => ({ success: false, data: null, error: 'Failed to parse JSON' }))) as ApiResponse<T>

  if (!res.ok || !payload.success) {
    throw new Error(payload.error ?? `PATCH ${path} → ${res.status}`)
  }
  return payload.data as T
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const api = {
  dashboard: {
    kpis: () => get<KpiStats>('/dashboard/kpis'),
    heatmap: () => get<HeatmapEntry[]>('/dashboard/heatmap'),
    health: () => get<SystemHealth>('/dashboard/health'),
  },

  // ─── Instruments ──────────────────────────────────────────────────────────
  instruments: {
    list: () => get<Instrument[]>('/instruments'),
    create: (body: {
      name: string
      description?: string
      assetClass?: string
      divider?: number
      startDate?: string
      isActive: boolean
    }) => post<Instrument>('/instruments', body),
    toggleActive: (id: string) => patch<Instrument>(`/instruments/${id}/active`),
    togglePause: (id: string) => patch<Instrument>(`/instruments/${id}/pause`),
  },

  // ─── Timeframes ─────────────────────────────────────────────────────────────
  timeframes: {
    list: () => get<Timeframe[]>('/timeframes'),
    toggleActive: (id: string) => patch<Timeframe>(`/timeframes/${id}/active`),
  },

  // ─── States ───────────────────────────────────────────────────────────────
  states: {
    distribution: () => get<StateDistribution[]>('/states/distribution'),
    recent: (params?: { page?: number; limit?: number; status?: string; jobType?: string; instrumentId?: string }) => {
      const q = new URLSearchParams()
      if (params?.page)         q.set('page', String(params.page))
      if (params?.limit)        q.set('limit', String(params.limit))
      if (params?.status)       q.set('status', params.status)
      if (params?.jobType)      q.set('jobType', params.jobType)
      if (params?.instrumentId) q.set('instrumentId', params.instrumentId)
      return get<StatesPage>(`/states/recent?${q}`)
    },
  },

  // ─── Progress ─────────────────────────────────────────────────────────────
  progress: {
    list: () => get<ProgressEntry[]>('/progress'),
  },

  // ─── Control ──────────────────────────────────────────────────────────────
  control: {
    actions: () => get<ActionDef[]>('/control/actions'),
    trigger: (key: string) => post<ControlResult>(`/control/${key}`),
  },

  // ─── Cron Jobs ─────────────────────────────────────────────────────────────
  crons: {
    list: () => get<import('@/types').Cron[]>('/crons'),
    get: (id: string) => get<import('@/types').Cron>(`/crons/${id}`),
    create: (body: {
      name: string
      description?: string
      cronExpr: string
      workerKey: string
      triggerMethod?: 'RABBITMQ' | 'HTTP'
      queueName?: string
      httpPath?: string
      status?: 'ACTIVE' | 'PAUSED' | 'INACTIVE'
    }) => post<import('@/types').Cron>('/crons', body),
    update: (id: string, body: {
      description?: string
      cronExpr?: string
      workerKey?: string
      triggerMethod?: 'RABBITMQ' | 'HTTP'
      queueName?: string | null
      httpPath?: string | null
      status?: 'ACTIVE' | 'PAUSED' | 'INACTIVE'
    }) => patch<import('@/types').Cron>(`/crons/${id}`, body),
    toggleStatus: (id: string) => patch<import('@/types').Cron>(`/crons/${id}/status`),
    trigger: (id: string) => post<import('@/types').CronTriggerResult>(`/crons/${id}/trigger`),
    delete: async (id: string) => {
      const res = await fetch(`/api/crons/${id}`, { method: 'DELETE' })
      const body = await res.json() as { success: boolean; data: unknown; error: string | null }
      if (!res.ok || !body.success) throw new Error(body.error ?? `DELETE /crons/${id} → ${res.status}`)
      return body.data
    },
  },
}
