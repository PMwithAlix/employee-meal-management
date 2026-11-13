import { authRequest } from '../auth/client'
import { AuthRequestError } from '../auth/errors'

const session = { treatUnauthorizedAsSessionEnd: true as const }

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export interface DirectoryUser {
  id: string
  username: string
  role: string
  buildingId: string | null
  isActive: boolean
}

function parseUser(value: unknown): DirectoryUser | null {
  const body = asRecord(value)
  if (!body || typeof body.id !== 'string' || typeof body.username !== 'string') return null
  if (typeof body.role !== 'string') return null
  return {
    id: body.id,
    username: body.username,
    role: body.role,
    buildingId: typeof body.buildingId === 'string' ? body.buildingId : null,
    isActive: body.isActive === true,
  }
}

const incomplete = () => new AuthRequestError('http', 'بارگذاری فهرست کاربران کامل نشد.')

export const userApi = {
  list(query: { page?: number; pageSize?: number; role?: string; isActive?: boolean; username?: string } = {}, signal?: AbortSignal) {
    const params = new URLSearchParams()
    params.set('page', String(query.page ?? 1))
    params.set('pageSize', String(query.pageSize ?? 100))
    if (query.role) params.set('role', query.role)
    if (query.isActive !== undefined) params.set('isActive', String(query.isActive))
    if (query.username) params.set('username', query.username)
    return authRequest<unknown>(`/users?${params.toString()}`, { ...session, signal }).then((body) => {
      const record = asRecord(body)
      if (!record || !Array.isArray(record.items)) throw incomplete()
      const items: DirectoryUser[] = []
      for (const item of record.items) {
        const parsed = parseUser(item)
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

  async listAll(query: { role?: string; isActive?: boolean } = {}, signal?: AbortSignal) {
    const pageSize = 100
    const maxPages = 50
    const collected: DirectoryUser[] = []
    let received = 0
    let page = 1
    let total: number | null = null
    for (;;) {
      if (page > maxPages) throw incomplete()
      const listed = await this.list({ ...query, page, pageSize }, signal)
      if (!Number.isInteger(listed.total) || listed.total < 0) throw incomplete()
      if (listed.page !== page || listed.pageSize !== pageSize) throw incomplete()
      if (listed.items.length > pageSize) throw incomplete()
      if (total === null) total = listed.total
      else if (listed.total !== total) throw incomplete()
      if (listed.items.length === 0) {
        if (received !== total) throw incomplete()
        break
      }
      received += listed.items.length
      if (received > total) throw incomplete()
      collected.push(...listed.items)
      const lastPage = total === 0 ? 1 : Math.ceil(total / pageSize)
      if (page >= lastPage) break
      page += 1
    }
    if (total === null || received !== total) throw incomplete()
    return { items: collected, total }
  },
}
