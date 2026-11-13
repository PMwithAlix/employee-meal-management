import { authRequest } from '../auth/client'
import { AuthRequestError } from '../auth/errors'
import { parseBackendOrder, parseDeadline, parseMealSetting, parseStaffRating, toUiOrder } from './map'
import { ORDER_ENDPOINTS, type CreateOrderBody, type UpsertRatingBody } from './types'
import type { Order } from '../types'

const session = { treatUnauthorizedAsSessionEnd: true as const }

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export const orderApi = {
  listMine(query: { from?: string; to?: string; page?: number; pageSize?: number } = {}, signal?: AbortSignal) {
    const params = new URLSearchParams()
    if (query.from) params.set('from', query.from)
    if (query.to) params.set('to', query.to)
    params.set('page', String(query.page ?? 1))
    params.set('pageSize', String(query.pageSize ?? 100))
    const suffix = `?${params.toString()}`
    return authRequest<unknown>(`${ORDER_ENDPOINTS.me}${suffix}`, { ...session, signal }).then((body) => {
      const record = asRecord(body)
      const items = Array.isArray(record?.items)
        ? record.items.map(parseBackendOrder).filter((item): item is NonNullable<typeof item> => item !== null)
        : []
      return {
        items,
        orders: items.map(toUiOrder).filter((item): item is Order => item !== null),
        total: typeof record?.total === 'number' ? record.total : Number.NaN,
        page: typeof record?.page === 'number' ? record.page : Number.NaN,
        pageSize: typeof record?.pageSize === 'number' ? record.pageSize : Number.NaN,
      }
    })
  },

  async listAllMine(signal?: AbortSignal) {
    const pageSize = 100
    const maxPages = 50
    const incomplete = () => new AuthRequestError('http', 'بارگذاری همه سفارش‌ها کامل نشد.')
    const orders: Order[] = []
    let received = 0
    let page = 1
    let total: number | null = null
    for (;;) {
      if (page > maxPages) throw incomplete()
      const listed = await this.listMine({ page, pageSize }, signal)
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
      orders.push(...listed.orders)
      const lastPage = total === 0 ? 1 : Math.ceil(total / pageSize)
      if (page >= lastPage) break
      page += 1
    }
    if (total === null || received !== total) throw incomplete()
    return { orders, total }
  },

  create(body: CreateOrderBody) {
    return authRequest<unknown>(ORDER_ENDPOINTS.create, { ...session, method: 'POST', body }).then((value) => {
      const parsed = parseBackendOrder(value)
      const order = parsed ? toUiOrder(parsed) : null
      if (!order) throw new Error('پاسخ ثبت سفارش نامعتبر است.')
      return order
    })
  },

  update(id: string, menuItemId: string) {
    return authRequest<unknown>(ORDER_ENDPOINTS.one(id), {
      ...session,
      method: 'PATCH',
      body: { menuItemId },
    }).then((value) => {
      const parsed = parseBackendOrder(value)
      const order = parsed ? toUiOrder(parsed) : null
      if (!order) throw new Error('پاسخ تغییر سفارش نامعتبر است.')
      return order
    })
  },

  cancel(id: string) {
    return authRequest<unknown>(ORDER_ENDPOINTS.cancel(id), { ...session, method: 'POST' }).then((value) => {
      const parsed = parseBackendOrder(value)
      const order = parsed ? toUiOrder(parsed) : null
      if (!order) throw new Error('پاسخ لغو سفارش نامعتبر است.')
      return order
    })
  },

  deadlines(year: number, month: number, signal?: AbortSignal) {
    return authRequest<unknown>(ORDER_ENDPOINTS.deadlines(year, month), { ...session, signal }).then((body) => {
      const rows = Array.isArray(body) ? body : []
      return rows.map(parseDeadline).filter((item): item is NonNullable<typeof item> => item !== null)
    })
  },

  mealSettings(signal?: AbortSignal) {
    return authRequest<unknown>(ORDER_ENDPOINTS.mealSettings, { ...session, signal }).then((body) => {
      const rows = Array.isArray(body) ? body : []
      return rows.map(parseMealSetting).filter((item): item is NonNullable<typeof item> => item !== null)
    })
  },

  replaceMealSettings(body: { items: Array<{ mealType: 'LUNCH' | 'DINNER'; servingTime: string }> }) {
    return authRequest<unknown>(ORDER_ENDPOINTS.mealSettings, { ...session, method: 'PUT', body }).then((value) => {
      const rows = Array.isArray(value) ? value : []
      return rows.map(parseMealSetting).filter((item): item is NonNullable<typeof item> => item !== null)
    })
  },

  upsertRating(orderId: string, body: UpsertRatingBody) {
    return authRequest<unknown>(ORDER_ENDPOINTS.rating(orderId), { ...session, method: 'PUT', body }).then((value) => {
      const parsed = parseStaffRating(value)
      if (!parsed) throw new Error('پاسخ ثبت دیدگاه نامعتبر است.')
      return parsed
    })
  },

  getRating(orderId: string, signal?: AbortSignal) {
    return authRequest<unknown>(ORDER_ENDPOINTS.rating(orderId), { ...session, signal }).then((value) => {
      const parsed = parseStaffRating(value)
      if (!parsed) throw new Error('پاسخ دیدگاه نامعتبر است.')
      return parsed
    })
  },

  listRatings(query: { page?: number; pageSize?: number; mealDate?: string; mealType?: 'LUNCH' | 'DINNER'; userId?: string } = {}, signal?: AbortSignal) {
    const params = new URLSearchParams()
    params.set('page', String(query.page ?? 1))
    params.set('pageSize', String(query.pageSize ?? 100))
    if (query.mealDate) params.set('mealDate', query.mealDate)
    if (query.mealType) params.set('mealType', query.mealType)
    if (query.userId) params.set('userId', query.userId)
    return authRequest<unknown>(`${ORDER_ENDPOINTS.ratings}?${params.toString()}`, { ...session, signal }).then((body) => {
      const record = asRecord(body)
      const items = Array.isArray(record?.items)
        ? record.items.map(parseStaffRating).filter((item): item is NonNullable<typeof item> => item !== null)
        : []
      return {
        items,
        total: typeof record?.total === 'number' ? record.total : items.length,
        page: typeof record?.page === 'number' ? record.page : query.page ?? 1,
        pageSize: typeof record?.pageSize === 'number' ? record.pageSize : query.pageSize ?? items.length,
      }
    })
  },

  async listAllRatings(query: { mealDate?: string; mealType?: 'LUNCH' | 'DINNER'; userId?: string } = {}, signal?: AbortSignal) {
    const pageSize = 100
    const maxPages = 50
    const incomplete = () => new AuthRequestError('http', 'بارگذاری همه دیدگاه‌ها کامل نشد.')
    const collected: NonNullable<ReturnType<typeof parseStaffRating>>[] = []
    let page = 1
    let total = 0
    for (;;) {
      if (page > maxPages) throw incomplete()
      const listed = await this.listRatings({ ...query, page, pageSize }, signal)
      total = listed.total
      if (listed.items.length === 0) break
      collected.push(...listed.items)
      if (page * pageSize >= total) break
      page += 1
    }
    return { items: collected, total }
  },
}
