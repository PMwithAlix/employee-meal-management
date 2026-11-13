import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthRequestError } from '../auth/errors'
import { orderApi } from './client'

describe('orderApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('follows backend pagination until every personal order is loaded', async () => {
    const page1 = Array.from({ length: 100 }, (_, index) => ({
      id: `order-${index}`,
      userId: 'user-1',
      mealDate: '2026-11-14',
      mealType: 'LUNCH',
      quantity: 1,
      status: 'ACTIVE',
      currentCycle: {
        id: `c-${index}`,
        cycleNumber: 1,
        menuItemId: 'item-1',
        menuVersionId: 'v1',
        optionTitle: 'عدسی',
        usernameSnapshot: 'emp',
        buildingIdSnapshot: null,
        buildingNameSnapshot: null,
        mealDateSnapshot: '2026-11-14',
        mealTypeSnapshot: 'LUNCH',
        status: 'ACTIVE',
        createdAt: '2026-11-14T00:00:00.000Z',
        groups: [],
      },
      rating: null,
    }))
    const fetchMock = vi.fn(async (url: string) => {
      const page = new URL(url, 'http://local.test').searchParams.get('page')
      if (page === '1') {
        return new Response(JSON.stringify({ items: page1, total: 101, page: 1, pageSize: 100 }), { status: 200 })
      }
      return new Response(JSON.stringify({
        items: [{ ...page1[0], id: 'order-100' }],
        total: 101,
        page: 2,
        pageSize: 100,
      }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const listed = await orderApi.listAllMine()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(listed.orders).toHaveLength(101)
    expect(listed.orders[100]?.id).toBe('order-100')
  })

  it('lists personal orders with credentials and without seed fallback', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 100 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await orderApi.listMine({ pageSize: 100 })
    const [url, init] = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0]
    expect(url).toContain('/api/v1/orders/me')
    expect(init.credentials).toBe('include')
    expect(result.orders).toEqual([])
  })

  it('creates an order with gregorian date, backend meal type, and menuItemId', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        id: 'order-1',
        userId: 'user-1',
        mealDate: '2026-11-14',
        mealType: 'LUNCH',
        quantity: 1,
        status: 'ACTIVE',
        currentCycle: {
          id: 'c1',
          cycleNumber: 1,
          menuItemId: '11111111-1111-1111-1111-111111111111',
          menuVersionId: 'v1',
          optionTitle: 'عدسی',
          usernameSnapshot: 'emp',
          buildingIdSnapshot: null,
          buildingNameSnapshot: null,
          mealDateSnapshot: '2026-11-14',
          mealTypeSnapshot: 'LUNCH',
          status: 'ACTIVE',
          createdAt: '2026-11-14T00:00:00.000Z',
          groups: [],
        },
        rating: null,
      }), { status: 201 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const saved = await orderApi.create({
      mealDate: '2026-11-14',
      mealType: 'LUNCH',
      menuItemId: '11111111-1111-1111-1111-111111111111',
    })
    const [, init] = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({
      mealDate: '2026-11-14',
      mealType: 'LUNCH',
      menuItemId: '11111111-1111-1111-1111-111111111111',
    }))
    expect(saved.menuItemId).toBe('11111111-1111-1111-1111-111111111111')
  })

  it('patches and cancels personal orders on /orders/me/:id', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const cancelled = String(url).includes('/cancel')
      return new Response(JSON.stringify({
        id: 'order-1',
        userId: 'user-1',
        mealDate: '2026-11-14',
        mealType: 'DINNER',
        quantity: 1,
        status: cancelled ? 'CANCELLED' : 'ACTIVE',
        currentCycle: {
          id: 'c1',
          cycleNumber: 2,
          menuItemId: 'item-2',
          menuVersionId: 'v1',
          optionTitle: 'سوپ',
          usernameSnapshot: 'emp',
          buildingIdSnapshot: null,
          buildingNameSnapshot: null,
          mealDateSnapshot: '2026-11-14',
          mealTypeSnapshot: 'DINNER',
          status: cancelled ? 'CANCELLED' : 'ACTIVE',
          createdAt: '2026-11-14T00:00:00.000Z',
          groups: [],
        },
        rating: null,
      }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    await orderApi.update('order-1', 'item-2')
    expect(String((fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0][0])).toBe('/api/v1/orders/me/order-1')
    expect((fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0][1].method).toBe('PATCH')
    const cancelled = await orderApi.cancel('order-1')
    expect(String((fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[1][0])).toContain('/cancel')
    expect(cancelled.choice).toBeNull()
  })

  it('treats 409 as a real conflict, not a local overwrite', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'برای این تاریخ و وعده سفارش فعال وجود دارد.' }), { status: 409 })))
    await expect(orderApi.create({ mealDate: '2026-11-14', mealType: 'LUNCH', menuItemId: 'item-1' })).rejects.toMatchObject({
      kind: 'conflict',
      status: 409,
    } satisfies Partial<AuthRequestError>)
  })

  it('loads monthly deadlines from /order-deadlines/:year/:month', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await orderApi.deadlines(1405, 8)
    expect(String((fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0][0])).toBe('/api/v1/order-deadlines/1405/8')
  })
})
