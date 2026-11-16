import { authRequest } from '../../auth/api/auth-api'
import { AuthRequestError } from '../../auth/lib/auth-errors'
import { parseBackendOrder, parseDeadline, parseDeadlinePolicy, parseMealSetting, parseStaffRating, toUiOrder } from '../lib/order-mapper'
import { ORDER_ENDPOINTS, type BackendOrder, type CreateOrderBody, type ManagedOrderQuery, type UpsertRatingBody } from '../model/order-types'
import type { Order } from '../../../shared/types/domain'

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
    const seen = new Set<string>()
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
      if (listed.orders.length !== listed.items.length) throw incomplete()
      for (const item of listed.orders) {
        if (seen.has(item.id)) throw incomplete()
        seen.add(item.id)
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

  listManaged(query: ManagedOrderQuery = {}, signal?: AbortSignal) {
    const params = new URLSearchParams()
    params.set('page', String(query.page ?? 1))
    params.set('pageSize', String(query.pageSize ?? 20))
    if (query.mealDate) params.set('mealDate', query.mealDate)
    if (query.from) params.set('from', query.from)
    if (query.to) params.set('to', query.to)
    if (query.mealType) params.set('mealType', query.mealType)
    if (query.userId) params.set('userId', query.userId)
    if (query.buildingId) params.set('buildingId', query.buildingId)
    if (query.groupId) params.set('groupId', query.groupId)
    if (query.username) params.set('username', query.username)
    if (query.status) params.set('status', query.status)
    return authRequest<unknown>(`${ORDER_ENDPOINTS.list}?${params.toString()}`, { ...session, signal }).then((body) => {
      const record = asRecord(body)
      if (!record || !Array.isArray(record.items)) {
        throw new AuthRequestError('http', 'بارگذاری سفارش‌های سازمان کامل نشد.')
      }
      const items: BackendOrder[] = []
      for (const item of record.items) {
        const parsed = parseBackendOrder(item)
        if (!parsed) throw new AuthRequestError('http', 'بارگذاری سفارش‌های سازمان کامل نشد.')
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

  async listAllManaged(query: Omit<ManagedOrderQuery, 'page' | 'pageSize'> = {}, signal?: AbortSignal) {
    const pageSize = 100
    const maxPages = 50
    const incomplete = () => new AuthRequestError('http', 'بارگذاری سفارش‌های سازمان کامل نشد.')
    const collected: BackendOrder[] = []
    let received = 0
    let page = 1
    let total: number | null = null
    for (;;) {
      if (page > maxPages) throw incomplete()
      const listed = await this.listManaged({ ...query, page, pageSize }, signal)
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

  async countManaged(query: Omit<ManagedOrderQuery, 'page' | 'pageSize'> = {}, signal?: AbortSignal) {
    const listed = await this.listManaged({ ...query, page: 1, pageSize: 1 }, signal)
    if (!Number.isInteger(listed.total) || listed.total < 0 || listed.page !== 1 || listed.pageSize !== 1) {
      throw new AuthRequestError('http', 'بارگذاری سفارش‌های سازمان کامل نشد.')
    }
    return listed.total
  },

  getManaged(id: string, signal?: AbortSignal) {
    return authRequest<unknown>(ORDER_ENDPOINTS.managed(id), { ...session, signal }).then((value) => {
      const parsed = parseBackendOrder(value)
      if (!parsed) throw new AuthRequestError('http', 'پاسخ سفارش نامعتبر است.')
      return parsed
    })
  },

  updateManaged(id: string, menuItemId: string) {
    return authRequest<unknown>(ORDER_ENDPOINTS.managed(id), {
      ...session,
      method: 'PATCH',
      body: { menuItemId },
    }).then((value) => {
      const parsed = parseBackendOrder(value)
      if (!parsed) throw new AuthRequestError('http', 'پاسخ تغییر سفارش نامعتبر است.')
      return parsed
    })
  },

  cancelManaged(id: string) {
    return authRequest<unknown>(ORDER_ENDPOINTS.managedCancel(id), { ...session, method: 'POST' }).then((value) => {
      const parsed = parseBackendOrder(value)
      if (!parsed) throw new AuthRequestError('http', 'پاسخ لغو سفارش نامعتبر است.')
      return parsed
    })
  },

  deadlinePolicy(signal?: AbortSignal) {
    return authRequest<unknown>(ORDER_ENDPOINTS.deadlinePolicy, { ...session, signal }).then((body) => {
      const rows = Array.isArray(body) ? body : []
      return rows.map(parseDeadlinePolicy).filter((item): item is NonNullable<typeof item> => item !== null)
    })
  },

  replaceDeadlinePolicy(items: Array<{ mealType: 'LUNCH' | 'DINNER'; relation: 'SAME_DAY' | 'PREVIOUS_DAY'; hour: number; minute: number }>) {
    return authRequest<unknown>(ORDER_ENDPOINTS.deadlinePolicy, {
      ...session,
      method: 'PUT',
      body: { items },
    }).then((body) => {
      if (!Array.isArray(body)) throw new AuthRequestError('http', 'پاسخ ذخیره مهلت نامعتبر است.')
      const rows = []
      for (const item of body) {
        const parsed = parseDeadlinePolicy(item)
        if (!parsed) throw new AuthRequestError('http', 'پاسخ ذخیره مهلت نامعتبر است.')
        rows.push(parsed)
      }
      return rows
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
      if (!Array.isArray(record?.items)) {
        throw new AuthRequestError('http', 'بارگذاری همه دیدگاه‌ها کامل نشد.')
      }
      const items = record.items.map(parseStaffRating).filter((item): item is NonNullable<typeof item> => item !== null)
      return {
        items,
        total: typeof record.total === 'number' ? record.total : Number.NaN,
        page: typeof record.page === 'number' ? record.page : Number.NaN,
        pageSize: typeof record.pageSize === 'number' ? record.pageSize : Number.NaN,
      }
    })
  },

  async listAllRatings(query: { mealDate?: string; mealType?: 'LUNCH' | 'DINNER'; userId?: string } = {}, signal?: AbortSignal) {
    const pageSize = 100
    const maxPages = 50
    const incomplete = () => new AuthRequestError('http', 'بارگذاری همه دیدگاه‌ها کامل نشد.')
    const collected: NonNullable<ReturnType<typeof parseStaffRating>>[] = []
    let received = 0
    let page = 1
    let total: number | null = null
    for (;;) {
      if (page > maxPages) throw incomplete()
      const listed = await this.listRatings({ ...query, page, pageSize }, signal)
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
