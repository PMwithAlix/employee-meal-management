import { afterEach, describe, expect, it, vi } from 'vitest'
import { reportApi } from './reports-api'

const counts = {
  lunchStaff: 1,
  lunchGuest: 0,
  dinnerStaff: 0,
  dinnerGuest: 0,
  lunchCount: 1,
  dinnerCount: 0,
  staffCount: 1,
  guestCount: 0,
  total: 1,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reportApi', () => {
  it('requests the daily report with the selected meal filter', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      mealDate: '2026-11-16',
      jalaliDate: '1405/08/25',
      generatedAt: '2026-11-16T12:00:00.000Z',
      meal: 'LUNCH',
      lunch: { mealType: 'LUNCH', foods: [], staffTotal: 0, guestTotal: 0, total: 0 },
      dinner: { mealType: 'DINNER', foods: [], staffTotal: 0, guestTotal: 0, total: 0 },
      buildings: [],
      unassignedGuests: [],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await reportApi.daily('2026-11-16', 'LUNCH')
    expect(String((fetchMock.mock.calls as unknown as Array<[string]>)[0][0])).toContain('/api/v1/reports/daily?')
    expect(String((fetchMock.mock.calls as unknown as Array<[string]>)[0][0])).toContain('meal=LUNCH')
    expect(result.meal).toBe('LUNCH')
  })

  it('requests the monthly aggregate from the backend instead of summing in the client', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      year: 1405,
      month: 9,
      monthLabel: 'آذر ۱۴۰۵',
      meal: 'ALL',
      mealLabel: 'هر دو وعده',
      generatedAt: '2026-11-16T12:00:00.000Z',
      foods: [{ title: 'قیمه', menuItemId: '1', ...counts }],
      foodsTotal: counts,
      buildingRows: [{ buildingId: 'b1', buildingName: 'مرکزی', title: 'قیمه', menuItemId: '1', ...counts }],
      buildingTotals: [{ buildingId: 'b1', buildingName: 'مرکزی', ...counts }],
      supply: [{ title: 'قیمه', menuItemId: '1', ...counts }],
      supplyTotal: counts,
      reconciliation: { foodsTotal: 1, buildingsTotal: 1, difference: 0, matched: true },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await reportApi.monthly(1405, 9, 'ALL')
    expect(String((fetchMock.mock.calls as unknown as Array<[string]>)[0][0])).toContain('/api/v1/reports/monthly?')
    expect(result.reconciliation.matched).toBe(true)
    expect(result.foodsTotal.total).toBe(1)
  })
})
