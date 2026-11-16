import { describe, expect, it } from 'vitest'
import { parseDailyReport, dishes } from './report-mapper'

describe('parseDailyReport', () => {
  it('accepts a complete daily payload and rejects a truncated one', () => {
    const payload = {
      mealDate: '2026-11-16',
      jalaliDate: '1405/08/25',
      generatedAt: '2026-11-16T12:00:00.000Z',
      lunch: { mealType: 'LUNCH', foods: [{ menuItemId: '1', title: 'جوجه', onMenu: true, staffCount: 1, guestCount: 2, total: 3 }], staffTotal: 1, guestTotal: 2, total: 3 },
      dinner: { mealType: 'DINNER', foods: [], staffTotal: 0, guestTotal: 0, total: 0 },
      buildings: [{ buildingId: 'b1', buildingName: 'دهقان', users: [{ userId: 'u1', name: 'علی', lunch: ['جوجه'], dinner: [] }], guests: [] }],
      unassignedGuests: [],
    }
    const parsed = parseDailyReport(payload)
    expect(parsed?.lunch.total).toBe(3)
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
