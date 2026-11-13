import { authRequest } from '../auth/client'
import { parseBackendOrder, parseDeadline, toUiOrder } from './map'
import { ORDER_ENDPOINTS, type CreateOrderBody } from './types'
import type { Order } from '../types'

const session = { treatUnauthorizedAsSessionEnd: true as const }

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export const orderApi = {
  listMine(query: { from?: string; to?: string; pageSize?: number } = {}, signal?: AbortSignal) {
    const params = new URLSearchParams()
    if (query.from) params.set('from', query.from)
    if (query.to) params.set('to', query.to)
    params.set('pageSize', String(query.pageSize ?? 100))
    const suffix = params.toString() ? `?${params.toString()}` : ''
    return authRequest<unknown>(`${ORDER_ENDPOINTS.me}${suffix}`, { ...session, signal }).then((body) => {
      const record = asRecord(body)
      const items = Array.isArray(record?.items)
        ? record.items.map(parseBackendOrder).filter((item): item is NonNullable<typeof item> => item !== null)
        : []
      return {
        items,
        orders: items.map(toUiOrder).filter((item): item is Order => item !== null),
        total: typeof record?.total === 'number' ? record.total : items.length,
        page: typeof record?.page === 'number' ? record.page : 1,
        pageSize: typeof record?.pageSize === 'number' ? record.pageSize : items.length,
      }
    })
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
