import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthRequestError } from '../auth/errors'
import { formatGregorianDate, jalaliFromMealDate } from '../menus/map'
import { jalaliMonthLength } from '../lib/jalali'
import { countActiveGuestOrdersInMonth } from './count'

function guestPage(total: number, itemCount = 1) {
  const items = Array.from({ length: itemCount }, (_, index) => ({
    id: `g-${index}`,
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
  }))
  return new Response(JSON.stringify({ items, total, page: 1, pageSize: 1 }), { status: 200 })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('countActiveGuestOrdersInMonth', () => {
  it('sums backend totals for active guest orders in the selected month', async () => {
    const year = 1405
    const month = 8
    const length = jalaliMonthLength(year, month)
    const mid = formatGregorianDate(year, month, 15)
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(url, 'http://local.test')
      expect(parsed.pathname).toBe('/api/v1/guest-orders')
      expect(parsed.searchParams.get('status')).toBe('ACTIVE')
      expect(parsed.searchParams.get('pageSize')).toBe('1')
      const mealDate = parsed.searchParams.get('mealDate')
      if (mealDate === mid) return guestPage(4)
      return guestPage(0, 0)
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(countActiveGuestOrdersInMonth(year, month)).resolves.toBe(4)
    expect(fetchMock).toHaveBeenCalledTimes(length)
  })

  it('does not treat the first page length as the monthly total', async () => {
    const year = 1405
    const month = 8
    const first = formatGregorianDate(year, month, 1)
    const fetchMock = vi.fn(async (url: string) => {
      const mealDate = new URL(url, 'http://local.test').searchParams.get('mealDate')
      if (mealDate === first) return guestPage(45, 1)
      return guestPage(0, 0)
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(countActiveGuestOrdersInMonth(year, month)).resolves.toBe(45)
  })

  it('returns zero when every day has a valid empty total', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => guestPage(0, 0)))
    await expect(countActiveGuestOrdersInMonth(1405, 8)).resolves.toBe(0)
  })

  it('rejects incomplete pagination metadata instead of falling back to seed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      items: [],
      page: 1,
      pageSize: 1,
    }), { status: 200 })))
    await expect(countActiveGuestOrdersInMonth(1405, 8)).rejects.toMatchObject({ kind: 'http' })
  })

  it('propagates API errors without inventing a count', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'قطع ارتباط' }), { status: 500 })))
    await expect(countActiveGuestOrdersInMonth(1405, 8)).rejects.toBeInstanceOf(AuthRequestError)
  })

  it('does not query dates outside the selected month', async () => {
    const year = 1405
    const month = 8
    const dates = new Set<string>()
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      dates.add(new URL(url, 'http://local.test').searchParams.get('mealDate') ?? '')
      return guestPage(0, 0)
    }))
    await countActiveGuestOrdersInMonth(year, month)
    expect(dates.size).toBe(jalaliMonthLength(year, month))
    for (const mealDate of dates) {
      const parsed = jalaliFromMealDate(mealDate)
      expect(parsed).toMatchObject({ jy: year, jm: month })
    }
  })
})
