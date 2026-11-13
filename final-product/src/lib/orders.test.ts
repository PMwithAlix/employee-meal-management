import { describe, expect, it } from 'vitest'
import { defaultMonthDeadlines } from './deadlines'
import { currentDateTime } from './jalali'
import { findOrder, isEmployeeDeadlineOpen, isMealOpen } from './orders'
import type { DayMenu, Order } from '../types'

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
  })
})
