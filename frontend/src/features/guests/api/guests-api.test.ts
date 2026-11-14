import { afterEach, describe, expect, it, vi } from 'vitest'
import { guestApi } from './guests-api'

function guest(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    buildingId: 'b1',
    menuItemId: 'm1',
    menuVersionId: 'v1',
    mealDate: '2026-10-23',
    jalaliDate: '1405/08/01',
    mealType: 'LUNCH',
    quantity: 2,
    note: null,
    status: 'ACTIVE',
    buildingNameSnapshot: 'اصلی',
    mealTitleSnapshot: 'عدسی',
    createdBy: 'user-1',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    history: [],
    ...extra,
  }
}

function jsonPage(page: number, total: number, items: unknown[]) {
  return new Response(JSON.stringify({ items, total, page, pageSize: 100 }), { status: 200 })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('guestApi', () => {
  it('lists guest orders from the real endpoint and keeps null snapshots', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      items: [guest('g1', { menuItemId: null, mealTitleSnapshot: null })],
      total: 1,
      page: 1,
      pageSize: 20,
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const listed = await guestApi.list({ buildingId: 'b1', page: 1, pageSize: 20 })
    expect(String((fetchMock.mock.calls as unknown as Array<[string]>)[0][0])).toContain('/api/v1/guest-orders')
    expect(listed.items[0]?.menuItemId).toBeNull()
    expect(listed.items[0]?.mealTitleSnapshot).toBeNull()
    expect(listed.total).toBe(1)
  })

  it('rejects a list payload that is missing an items array', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ total: 0, page: 1, pageSize: 20 }), { status: 200 })))
    await expect(guestApi.list()).rejects.toMatchObject({ kind: 'http', message: 'بارگذاری فهرست سفارش‌های مهمان کامل نشد.' })
  })

  it('rejects an unparsable guest-order row instead of inventing data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      items: [{ id: 'g1' }],
      total: 1,
      page: 1,
      pageSize: 20,
    }), { status: 200 })))
    await expect(guestApi.list()).rejects.toMatchObject({ kind: 'http' })
  })

  it('loads guest orders across pages when totals match', async () => {
    const page1 = Array.from({ length: 100 }, (_, index) => guest(`g-${index}`))
    const fetchMock = vi.fn(async (url: string) => {
      const page = new URL(url, 'http://local.test').searchParams.get('page')
      if (page === '1') return jsonPage(1, 101, page1)
      return jsonPage(2, 101, [guest('g-100')])
    })
    vi.stubGlobal('fetch', fetchMock)
    const listed = await guestApi.listAll()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(listed.items).toHaveLength(101)
    expect(listed.total).toBe(101)
  })

  it('rejects incomplete pagination metadata', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      items: [guest('g1')],
      total: 1,
      page: 9,
      pageSize: 100,
    }), { status: 200 })))
    await expect(guestApi.listAll()).rejects.toMatchObject({ kind: 'http' })
  })

  it('parses create, update, cancel, and detail responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(guest('g1', { quantity: 4 })), { status: 201 })))
    const created = await guestApi.create({
      buildingId: 'b1',
      mealDate: '2026-10-23',
      mealType: 'LUNCH',
      menuItemId: 'm1',
      quantity: 4,
    })
    expect(created.quantity).toBe(4)

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(guest('g1', { quantity: 5 })), { status: 200 })))
    expect((await guestApi.update('g1', { quantity: 5 })).quantity).toBe(5)

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(guest('g1', { status: 'CANCELLED' })), { status: 200 })))
    expect((await guestApi.cancel('g1')).status).toBe('CANCELLED')

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'g1' }), { status: 200 })))
    await expect(guestApi.get('g1')).rejects.toMatchObject({ kind: 'http', message: 'پاسخ سفارش مهمان نامعتبر است.' })
  })
})
