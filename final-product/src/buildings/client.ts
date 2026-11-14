import { authRequest } from '../auth/client'
import { AuthRequestError } from '../auth/errors'
import { parseBuilding, parseBuildingDetail, type BuildingDetail, type BuildingSummary } from './map'

export type { BuildingDetail, BuildingSummary }

const session = { treatUnauthorizedAsSessionEnd: true as const }

const incomplete = () => new AuthRequestError('http', 'بارگذاری فهرست ساختمان‌ها کامل نشد.')
const invalid = () => new AuthRequestError('http', 'پاسخ ساختمان نامعتبر است.')

function requireBuilding(value: unknown): BuildingSummary {
  const parsed = parseBuilding(value)
  if (!parsed) throw invalid()
  return parsed
}

function requireDetail(value: unknown): BuildingDetail {
  const parsed = parseBuildingDetail(value)
  if (!parsed) throw invalid()
  return parsed
}

export const buildingApi = {
  list(signal?: AbortSignal) {
    return authRequest<unknown>('/buildings', { ...session, signal }).then((body) => {
      if (!Array.isArray(body)) throw incomplete()
      const items: BuildingSummary[] = []
      for (const item of body) {
        const parsed = parseBuilding(item)
        if (!parsed) throw incomplete()
        items.push(parsed)
      }
      return items
    })
  },

  get(id: string, signal?: AbortSignal) {
    return authRequest<unknown>(`/buildings/${id}`, { ...session, signal }).then(requireDetail)
  },

  create(name: string, signal?: AbortSignal) {
    return authRequest<unknown>('/buildings', { ...session, method: 'POST', body: { name }, signal }).then(requireBuilding)
  },

  update(id: string, name: string, signal?: AbortSignal) {
    return authRequest<unknown>(`/buildings/${id}`, { ...session, method: 'PATCH', body: { name }, signal }).then(requireBuilding)
  },

  deactivate(id: string, signal?: AbortSignal) {
    return authRequest<unknown>(`/buildings/${id}/deactivate`, {
      ...session,
      method: 'POST',
      signal,
    }).then(requireBuilding)
  },

  reactivate(id: string, signal?: AbortSignal) {
    return authRequest<unknown>(`/buildings/${id}/reactivate`, {
      ...session,
      method: 'POST',
      signal,
    }).then(requireBuilding)
  },
}
