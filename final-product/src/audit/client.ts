import { authRequest } from '../auth/client'
import { AuthRequestError } from '../auth/errors'

const session = { treatUnauthorizedAsSessionEnd: true as const }

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export interface AuditLogItem {
  id: string
  action: string
  entityType: string
  entityId: string
  actorId: string | null
  actorUsername: string | null
  beforeData: unknown
  afterData: unknown
  createdAt: string
}

const incomplete = () => new AuthRequestError('http', 'بارگذاری تاریخچه فعالیت کامل نشد.')

function parseItem(value: unknown): AuditLogItem | null {
  const body = asRecord(value)
  if (!body || typeof body.id !== 'string' || typeof body.action !== 'string') return null
  if (typeof body.entityType !== 'string' || typeof body.entityId !== 'string') return null
  const actor = asRecord(body.actor)
  return {
    id: body.id,
    action: body.action,
    entityType: body.entityType,
    entityId: body.entityId,
    actorId: typeof body.actorId === 'string' ? body.actorId : null,
    actorUsername: typeof actor?.username === 'string' ? actor.username : null,
    beforeData: body.beforeData ?? null,
    afterData: body.afterData ?? null,
    createdAt: typeof body.createdAt === 'string' ? body.createdAt : '',
  }
}

export const auditApi = {
  list(query: { page?: number; pageSize?: number; action?: string; from?: string; to?: string } = {}, signal?: AbortSignal) {
    const params = new URLSearchParams()
    params.set('page', String(query.page ?? 1))
    params.set('pageSize', String(query.pageSize ?? 20))
    if (query.action) params.set('action', query.action)
    if (query.from) params.set('from', query.from)
    if (query.to) params.set('to', query.to)
    return authRequest<unknown>(`/audit-logs?${params.toString()}`, { ...session, signal }).then((body) => {
      const record = asRecord(body)
      if (!record || !Array.isArray(record.items)) throw incomplete()
      const items: AuditLogItem[] = []
      for (const item of record.items) {
        const parsed = parseItem(item)
        if (!parsed) throw incomplete()
        items.push(parsed)
      }
      return {
        items,
        total: typeof record.total === 'number' ? record.total : Number.NaN,
        page: typeof record.page === 'number' ? record.page : Number.NaN,
        pageSize: typeof record.pageSize === 'number' ? record.pageSize : Number.NaN,
      }
    })
  },
}
