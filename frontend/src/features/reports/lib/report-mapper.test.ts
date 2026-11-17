import { describe, expect, it } from 'vitest'
import { parseDailyReport, parseMonthlyReport, dishes, foodsWithOrders, mealFilterLabel } from './report-mapper'

describe('parseDailyReport', () => {
  it('accepts a complete daily payload and rejects a truncated one', () => {
    const payload = {
      mealDate: '2026-11-16',
      jalaliDate: '1405/08/25',
      generatedAt: '2026-11-16T12:00:00.000Z',
      lunch: { mealType: 'LUNCH', foods: [{ menuItemId: '1', title: 'جوجه', staffCount: 1, guestCount: 2, total: 3 }], staffTotal: 1, guestTotal: 2, total: 3 },
      dinner: { mealType: 'DINNER', foods: [], staffTotal: 0, guestTotal: 0, total: 0 },
      buildings: [{ buildingId: 'b1', buildingName: 'دهقان', users: [{ userId: 'u1', name: 'علی', lunch: ['جوجه'], dinner: [] }], guests: [] }],
      unassignedGuests: [],
    }
    const parsed = parseDailyReport(payload)
    expect(parsed?.lunch.total).toBe(3)
    expect(parsed?.meal).toBe('ALL')
    expect(parsed?.buildings[0]?.users[0]?.name).toBe('علی')
    expect(parseDailyReport({ ...payload, lunch: { mealType: 'LUNCH' } })).toBeNull()
  })
})

describe('dishes', () => {
  it('joins multiple meals and uses a dash when empty', () => {
    expect(dishes(['چلو', 'خورش'])).toBe('چلو، خورش')
    expect(dishes([])).toBe('—')
  })
})

describe('parseMonthlyReport', () => {
  it('accepts a complete monthly payload and rejects a truncated one', () => {
    const counts = { lunchStaff: 1, lunchGuest: 2, dinnerStaff: 0, dinnerGuest: 0, lunchCount: 3, dinnerCount: 0, staffCount: 1, guestCount: 2, total: 3 }
    const payload = {
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
      reconciliation: { foodsTotal: 3, buildingsTotal: 3, difference: 0, matched: true },
    }
    const parsed = parseMonthlyReport(payload)
    expect(parsed?.foodsTotal.total).toBe(3)
    expect(parsed?.reconciliation.matched).toBe(true)
    expect(mealFilterLabel('LUNCH')).toBe('فقط ناهار')
    expect(parseMonthlyReport({ ...payload, foods: [{}] })).toBeNull()
  })
})

describe('foodsWithOrders', () => {
  it('drops zero-total menu rows', () => {
    expect(foodsWithOrders([
      { menuItemId: '1', title: 'جوجه', staffCount: 1, guestCount: 0, total: 1 },
      { menuItemId: '2', title: 'قیمه', staffCount: 0, guestCount: 0, total: 0 },
    ]).map((item) => item.title)).toEqual(['جوجه'])
  })
})
