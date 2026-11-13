import { authRequest } from '../auth/client'
import { AuthRequestError } from '../auth/errors'
import { parseBackendOrder, parseDeadline, toUiOrder } from './map'
import { ORDER_ENDPOINTS, type CreateOrderBody } from './types'
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
}
