import { describe, expect, it } from 'vitest'
import { defaultMonthDeadlines } from './deadlines'
import { currentDateTime } from './jalali'
import { canGiveFeedback, classifyEmployeeDeadline, findCancelledOrder, findOrder, isElapsedDeadlineDay, isEmployeeDeadlineOpen, isMealOpen, isOpenDeadlineDay, matchesStatus } from './order-rules'
import type { DayMenu, Order } from '../types/domain'

const day: DayMenu = {
  jy: 1405,
  jm: 8,
  jd: 1,
  weekday: 'شنبه',
  lunch: ['عدسی'],
  dinner: ['سوپ'],
}

describe('isEmployeeDeadlineOpen', () => {
  it('keeps a regular order closed when no deadline exists or the lookup failed', () => {
    expect(isEmployeeDeadlineOpen('absent')).toBe(false)
    expect(isEmployeeDeadlineOpen('unknown')).toBe(false)
  })

  it('treats the exact deadline instant as closed, matching the backend', () => {
    const at = '2026-08-22T06:30:00.000Z'
    expect(isEmployeeDeadlineOpen({ at }, new Date(at))).toBe(false)
    expect(isEmployeeDeadlineOpen({ at }, new Date('2026-08-22T06:29:59.999Z'))).toBe(true)
  })

  it('does not treat an unparseable deadline as elapsed or as a local fallback', () => {
    const now = new Date('2026-08-22T06:30:00.000Z')
    expect(classifyEmployeeDeadline({ at: 'not-a-date' }, now)).toBe('unknown')
    expect(classifyEmployeeDeadline({ at: '' }, now)).toBe('unknown')
    expect(isEmployeeDeadlineOpen({ at: 'not-a-date' }, now)).toBe(false)
    expect(isMealOpen(day, 'lunch', defaultMonthDeadlines(), currentDateTime(), { at: 'not-a-date' })).toBe(false)
  })
})

describe('isMealOpen', () => {
  const now = currentDateTime()
  const local = defaultMonthDeadlines()

  it('does not fall back to the local default when a backend deadline is absent', () => {
    expect(isMealOpen(day, 'lunch', local, now, 'absent')).toBe(false)
  })

  it('still uses local seed deadlines when no backend state is passed', () => {
    expect(typeof isMealOpen(day, 'lunch', local, now)).toBe('boolean')
  })
})

describe('matchesStatus open filter', () => {
  const now = currentDateTime()
  const local = defaultMonthDeadlines()
  const query = { meal: 'all', status: 'open', q: '' } as const

  it('uses the backend deadline state, not the local default', () => {
    expect(matchesStatus(day, undefined, 'lunch', query.status, local, now, 'absent')).toBe(false)
    expect(matchesStatus(day, undefined, 'lunch', query.status, local, now, 'unknown')).toBe(false)
    expect(matchesStatus(day, undefined, 'lunch', query.status, local, now, { at: '2000-01-01T00:00:00.000Z' })).toBe(false)
    expect(matchesStatus(day, undefined, 'dinner', query.status, local, now, { at: '2099-01-01T00:00:00.000Z' })).toBe(true)
  })
})

describe('isElapsedDeadlineDay', () => {
  const past = { at: '2000-01-01T00:00:00.000Z' }
  const future = { at: '2099-01-01T00:00:00.000Z' }
  const empty: DayMenu = { ...day, lunch: null, dinner: null }

  it('counts a day as elapsed only when every defined meal has a definite closed deadline', () => {
    expect(isElapsedDeadlineDay(day, () => past)).toBe(true)
    expect(isElapsedDeadlineDay(day, (_d, meal) => (meal === 'lunch' ? future : past))).toBe(false)
    expect(isElapsedDeadlineDay(day, (_d, meal) => (meal === 'lunch' ? 'unknown' : past))).toBe(false)
    expect(isElapsedDeadlineDay(day, (_d, meal) => (meal === 'lunch' ? 'absent' : past))).toBe(true)
    expect(isElapsedDeadlineDay(empty, () => past)).toBe(false)
  })

  it('does not treat loading or failed deadline lookup as elapsed or open', () => {
    expect(isElapsedDeadlineDay(day, () => 'unknown')).toBe(false)
    expect(isOpenDeadlineDay(day, () => 'unknown')).toBe(false)
    expect(classifyEmployeeDeadline('unknown')).toBe('unknown')
    expect(classifyEmployeeDeadline('absent')).toBe('absent')
    const now = new Date('2026-08-22T06:30:00.000Z')
    expect(classifyEmployeeDeadline({ at: '2026-08-22T07:00:00.000Z' }, now)).toBe('open')
    expect(classifyEmployeeDeadline({ at: '2026-08-22T06:00:00.000Z' }, now)).toBe('elapsed')
    expect(classifyEmployeeDeadline({ at: '2026-08-22T06:30:00.000Z' }, now)).toBe('elapsed')
  })
})

describe('canGiveFeedback', () => {
  const order: Order = {
    id: 'o1',
    employeeId: 'user-1',
    buildingId: 'b1',
    jy: 1405,
    jm: 8,
    jd: 1,
    meal: 'lunch',
    choice: 'عدسی',
    rating: null,
  }
  const now = { jy: 1405, jm: 8, jd: 1, hour: 13, minute: 0 }

  it('does not allow rating without backend serving clocks or a meal choice', () => {
    expect(canGiveFeedback(order, now, null)).toBe(false)
    expect(canGiveFeedback({ ...order, choice: null }, now, { lunch: '12:00', dinner: '19:00' })).toBe(false)
    expect(canGiveFeedback(order, now, { lunch: '12:00', dinner: '19:00' })).toBe(true)
    expect(canGiveFeedback(order, { ...now, hour: 11, minute: 0 }, { lunch: '12:00', dinner: '19:00' })).toBe(false)
  })
})

describe('findOrder', () => {
  it('does not treat a cancelled order as the active selection', () => {
    const cancelled: Order = {
      id: 'o1',
      employeeId: 'user-1',
      buildingId: 'b1',
      jy: 1405,
      jm: 8,
      jd: 1,
      meal: 'lunch',
      choice: null,
      snapshotTitle: 'چلوکباب',
      menuItemId: null,
      cycleStatus: 'CANCELLED',
      rating: null,
    }
    expect(findOrder([cancelled], 'user-1', day, 1, 'lunch')).toBeUndefined()
    expect(findCancelledOrder([cancelled], 'user-1', day, 1, 'lunch')?.snapshotTitle).toBe('چلوکباب')
  })
})
