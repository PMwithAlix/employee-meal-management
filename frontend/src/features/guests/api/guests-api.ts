import { authRequest } from '../../auth/api/auth-api'
import { AuthRequestError } from '../../auth/lib/auth-errors'
import { parseGuestOrder } from '../lib/guest-mapper'
import {
  GUEST_ENDPOINTS,
  type BackendGuestOrder,
  type CreateGuestOrderBody,
  type GuestListQuery,
  type UpdateGuestOrderBody,
} from '../model/guest-types'

const session = { treatUnauthorizedAsSessionEnd: true as const }

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

const incompleteList = () => new AuthRequestError('http', 'بارگذاری فهرست سفارش‌های مهمان کامل نشد.')
const incompleteOne = () => new AuthRequestError('http', 'پاسخ سفارش مهمان نامعتبر است.')

function requireOrder(value: unknown): BackendGuestOrder {
  const parsed = parseGuestOrder(value)
  if (!parsed) throw incompleteOne()
  return parsed
}

export const guestApi = {
  list(query: GuestListQuery = {}, signal?: AbortSignal) {
    const params = new URLSearchParams()
    params.set('page', String(query.page ?? 1))
    params.set('pageSize', String(query.pageSize ?? 20))
    if (query.mealDate) params.set('mealDate', query.mealDate)
    if (query.mealType) params.set('mealType', query.mealType)
    if (query.buildingId) params.set('buildingId', query.buildingId)
    if (query.status) params.set('status', query.status)
    if (query.sortOrder) params.set('sortOrder', query.sortOrder)
    return authRequest<unknown>(`${GUEST_ENDPOINTS.list}?${params.toString()}`, { ...session, signal }).then((body) => {
      const record = asRecord(body)
      if (!record || !Array.isArray(record.items)) throw incompleteList()
      const items: BackendGuestOrder[] = []
      for (const item of record.items) {
        const parsed = parseGuestOrder(item)
        if (!parsed) throw incompleteList()
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

  async listAll(query: Omit<GuestListQuery, 'page' | 'pageSize'> = {}, signal?: AbortSignal) {
    const pageSize = 100
    const maxPages = 50
    const collected: BackendGuestOrder[] = []
    let received = 0
    let page = 1
    let total: number | null = null
    for (;;) {
      if (page > maxPages) throw incompleteList()
      const listed = await this.list({ ...query, page, pageSize }, signal)
      if (!Number.isInteger(listed.total) || listed.total < 0) throw incompleteList()
      if (listed.page !== page || listed.pageSize !== pageSize) throw incompleteList()
      if (listed.items.length > pageSize) throw incompleteList()
      if (total === null) total = listed.total
      else if (listed.total !== total) throw incompleteList()
      if (listed.items.length === 0) {
        if (received !== total) throw incompleteList()
        break
      }
      received += listed.items.length
      if (received > total) throw incompleteList()
      collected.push(...listed.items)
      const lastPage = total === 0 ? 1 : Math.ceil(total / pageSize)
      if (page >= lastPage) break
      page += 1
    }
    if (total === null || received !== total) throw incompleteList()
    return { items: collected, total }
  },

  get(id: string, signal?: AbortSignal) {
    return authRequest<unknown>(GUEST_ENDPOINTS.one(id), { ...session, signal }).then(requireOrder)
  },

  create(body: CreateGuestOrderBody) {
    return authRequest<unknown>(GUEST_ENDPOINTS.list, { ...session, method: 'POST', body }).then(requireOrder)
  },

  update(id: string, body: UpdateGuestOrderBody) {
    return authRequest<unknown>(GUEST_ENDPOINTS.one(id), { ...session, method: 'PATCH', body }).then(requireOrder)
  },

  cancel(id: string) {
    return authRequest<unknown>(GUEST_ENDPOINTS.cancel(id), { ...session, method: 'POST' }).then(requireOrder)
  },
}
