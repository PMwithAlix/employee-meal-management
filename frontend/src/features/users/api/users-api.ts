import { authRequest } from '../../auth/api/auth-api'
import { AuthRequestError } from '../../auth/lib/auth-errors'
import { parseManagedUser, parseResetPasswordResult, type ManagedUser } from '../lib/user-mapper'

const session = { treatUnauthorizedAsSessionEnd: true as const }

export type DirectoryUser = ManagedUser

export type UserListQuery = {
  page?: number
  pageSize?: number
  role?: string
  isActive?: boolean
  username?: string
  buildingId?: string
  sortBy?: 'createdAt' | 'username' | 'role'
  sortOrder?: 'asc' | 'desc'
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

const incomplete = () => new AuthRequestError('http', 'بارگذاری فهرست کاربران کامل نشد.')
const invalidUser = () => new AuthRequestError('http', 'پاسخ کاربر نامعتبر است.')

function parseListed(body: unknown) {
  const record = asRecord(body)
  if (!record || !Array.isArray(record.items)) throw incomplete()
  const items: ManagedUser[] = []
  for (const item of record.items) {
    const parsed = parseManagedUser(item)
    if (!parsed) throw incomplete()
    items.push(parsed)
  }
  return {
    items,
    total: typeof record.total === 'number' ? record.total : Number.NaN,
    page: typeof record.page === 'number' ? record.page : Number.NaN,
    pageSize: typeof record.pageSize === 'number' ? record.pageSize : Number.NaN,
  }
}

function requireUser(value: unknown) {
  const parsed = parseManagedUser(value)
  if (!parsed) throw invalidUser()
  return parsed
}

export const userApi = {
  list(query: UserListQuery = {}, signal?: AbortSignal) {
    const params = new URLSearchParams()
    params.set('page', String(query.page ?? 1))
    params.set('pageSize', String(query.pageSize ?? 100))
    params.set('sortBy', query.sortBy ?? 'createdAt')
    params.set('sortOrder', query.sortOrder ?? 'desc')
    if (query.role) params.set('role', query.role)
    if (query.isActive !== undefined) params.set('isActive', String(query.isActive))
    if (query.username) params.set('username', query.username)
    if (query.buildingId) params.set('buildingId', query.buildingId)
    return authRequest<unknown>(`/users?${params.toString()}`, { ...session, signal }).then(parseListed)
  },

  async listAll(query: Omit<UserListQuery, 'page' | 'pageSize'> = {}, signal?: AbortSignal) {
    const pageSize = 100
    const maxPages = 50
    const collected: ManagedUser[] = []
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

  get(id: string, signal?: AbortSignal) {
    return authRequest<unknown>(`/users/${id}`, { ...session, signal }).then(requireUser)
  },

  create(body: { username: string; password: string; role: string; buildingId?: string | null }, signal?: AbortSignal) {
    return authRequest<unknown>('/users', { ...session, method: 'POST', body, signal }).then(requireUser)
  },

  update(id: string, body: { buildingId?: string | null; role?: string }, signal?: AbortSignal) {
    return authRequest<unknown>(`/users/${id}`, { ...session, method: 'PATCH', body, signal }).then(requireUser)
  },

  deactivate(id: string, signal?: AbortSignal) {
    return authRequest<unknown>(`/users/${id}/deactivate`, { ...session, method: 'POST', signal }).then(requireUser)
  },

  reactivate(id: string, signal?: AbortSignal) {
    return authRequest<unknown>(`/users/${id}/reactivate`, { ...session, method: 'POST', signal }).then(requireUser)
  },

  remove(id: string, signal?: AbortSignal) {
    return authRequest<unknown>(`/users/${id}`, { ...session, method: 'DELETE', signal }).then((value) => {
      if (!parseResetPasswordResult(value)) {
        throw new AuthRequestError('http', 'حذف کاربر تأیید نشد.')
      }
      return { ok: true as const }
    })
  },

  resetPassword(id: string, newPassword: string, signal?: AbortSignal) {
    return authRequest<unknown>(`/users/${id}/reset-password`, {
      ...session,
      method: 'POST',
      body: { newPassword },
      signal,
    }).then((value) => {
      if (!parseResetPasswordResult(value)) {
        throw new AuthRequestError('http', 'بازنشانی رمز عبور تأیید نشد.')
      }
      return { ok: true as const }
    })
  },
}
