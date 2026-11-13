import { authRequest } from '../auth/client'
import { AuthRequestError } from '../auth/errors'

const session = { treatUnauthorizedAsSessionEnd: true as const }

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export interface BuildingSummary {
  id: string
  name: string
}

function parseBuilding(value: unknown): BuildingSummary | null {
  const body = asRecord(value)
  if (!body || typeof body.id !== 'string' || typeof body.name !== 'string') return null
  return { id: body.id, name: body.name }
}

export const buildingApi = {
  list(signal?: AbortSignal) {
    return authRequest<unknown>('/buildings', { ...session, signal }).then((body) => {
      if (!Array.isArray(body)) {
        throw new AuthRequestError('http', 'بارگذاری فهرست ساختمان‌ها کامل نشد.')
      }
      const items: BuildingSummary[] = []
      for (const item of body) {
        const parsed = parseBuilding(item)
        if (!parsed) throw new AuthRequestError('http', 'بارگذاری فهرست ساختمان‌ها کامل نشد.')
        items.push(parsed)
      }
      return items
    })
  },
}
