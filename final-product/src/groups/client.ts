import { authRequest } from '../auth/client'
import { AuthRequestError } from '../auth/errors'

const session = { treatUnauthorizedAsSessionEnd: true as const }

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export interface DirectoryGroup {
  id: string
  name: string
}

export const groupApi = {
  list(signal?: AbortSignal) {
    return authRequest<unknown>('/groups', { ...session, signal }).then((body) => {
      if (!Array.isArray(body)) {
        throw new AuthRequestError('http', 'بارگذاری فهرست گروه‌ها کامل نشد.')
      }
      const items: DirectoryGroup[] = []
      for (const item of body) {
        const row = asRecord(item)
        if (!row || typeof row.id !== 'string' || typeof row.name !== 'string') {
          throw new AuthRequestError('http', 'بارگذاری فهرست گروه‌ها کامل نشد.')
        }
        items.push({ id: row.id, name: row.name })
      }
      return items
    })
  },

  members(id: string, signal?: AbortSignal) {
    return authRequest<unknown>(`/groups/${id}/members`, { ...session, signal }).then((body) => {
      if (!Array.isArray(body)) {
        throw new AuthRequestError('http', 'بارگذاری اعضای گروه کامل نشد.')
      }
      const ids: string[] = []
      for (const item of body) {
        const row = asRecord(item)
        const userId = typeof row?.userId === 'string' ? row.userId : typeof row?.id === 'string' ? row.id : null
        if (!userId) throw new AuthRequestError('http', 'بارگذاری اعضای گروه کامل نشد.')
        ids.push(userId)
      }
      return ids
    })
  },
}
