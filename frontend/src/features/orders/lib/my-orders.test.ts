import { describe, expect, it } from 'vitest'
import { formatGregorianDate, jalaliFromJalaliField, jalaliFromMealDate } from '../../menus/lib/menu-mapper'
import { jalaliMonthLength } from '../../../shared/lib/jalali'
import type { DayMenu, Order } from '../../../shared/types/domain'
import { daysForMyOrders, mealDisplayName, orderTimeBucket, partitionMyOrders } from './my-orders'

function order(partial: Partial<Order> & Pick<Order, 'id' | 'jy' | 'jm' | 'jd'>): Order {
  return {
    employeeId: 'user-1',
    buildingId: 'b1',
    meal: 'lunch',
    choice: 'عدسی',
    snapshotTitle: 'عدسی',
    cycleStatus: 'ACTIVE',
    rating: null,
    ...partial,
  }
}

const aban = { jy: 1405, jm: 8 }

describe('orderTimeBucket', () => {
  it('places orders before, inside, and after the selected month without overlap', () => {
    expect(orderTimeBucket({ jy: 1405, jm: 7, jd: 30 }, aban)).toBe('past')
    expect(orderTimeBucket({ jy: 1405, jm: 8, jd: 1 }, aban)).toBe('current')
    expect(orderTimeBucket({ jy: 1405, jm: 8, jd: 30 }, aban)).toBe('current')
    expect(orderTimeBucket({ jy: 1405, jm: 9, jd: 1 }, aban)).toBe('future')
  })

  it('keeps the same month in another year in a different bucket', () => {
    expect(orderTimeBucket({ jy: 1404, jm: 8, jd: 10 }, aban)).toBe('past')
    expect(orderTimeBucket({ jy: 1406, jm: 8, jd: 10 }, aban)).toBe('future')
  })

  it('uses inclusive month bounds, including 29/30/31-day months', () => {
    expect(jalaliMonthLength(1405, 6)).toBe(31)
    expect(orderTimeBucket({ jy: 1405, jm: 6, jd: 31 }, { jy: 1405, jm: 6 })).toBe('current')
    expect(orderTimeBucket({ jy: 1405, jm: 7, jd: 1 }, { jy: 1405, jm: 6 })).toBe('future')
    expect(jalaliMonthLength(1405, 7)).toBe(30)
    expect(orderTimeBucket({ jy: 1405, jm: 7, jd: 30 }, { jy: 1405, jm: 7 })).toBe('current')
    expect(orderTimeBucket({ jy: 1405, jm: 7, jd: 31 }, { jy: 1405, jm: 7 })).toBe('invalid')
    expect(jalaliMonthLength(1403, 12)).toBe(30)
    expect(orderTimeBucket({ jy: 1403, jm: 12, jd: 30 }, { jy: 1403, jm: 12 })).toBe('current')
    expect(orderTimeBucket({ jy: 1404, jm: 1, jd: 1 }, { jy: 1403, jm: 12 })).toBe('future')
    expect(jalaliMonthLength(1404, 12)).toBe(29)
    expect(orderTimeBucket({ jy: 1404, jm: 12, jd: 29 }, { jy: 1404, jm: 12 })).toBe('current')
    expect(orderTimeBucket({ jy: 1404, jm: 12, jd: 30 }, { jy: 1404, jm: 12 })).toBe('invalid')
  })

  it('classifies across Esfand and Farvardin by year, not by month number', () => {
    expect(orderTimeBucket({ jy: 1404, jm: 12, jd: 29 }, { jy: 1405, jm: 1 })).toBe('past')
    expect(orderTimeBucket({ jy: 1405, jm: 1, jd: 1 }, { jy: 1404, jm: 12 })).toBe('future')
    expect(orderTimeBucket({ jy: 1405, jm: 1, jd: 1 }, { jy: 1405, jm: 1 })).toBe('current')
  })

  it('does not assign an invalid date to any month', () => {
    expect(orderTimeBucket({ jy: 0, jm: 0, jd: 0 }, aban)).toBe('invalid')
    expect(orderTimeBucket({ jy: 1405, jm: 12, jd: 30 }, aban)).toBe('invalid')
  })
})

describe('partitionMyOrders', () => {
  it('splits past, selected month, and future without duplicates', () => {
    const items = [
      order({ id: 'past', jy: 1405, jm: 7, jd: 15 }),
      order({ id: 'current', jy: 1405, jm: 8, jd: 10 }),
      order({ id: 'future', jy: 1405, jm: 9, jd: 1 }),
      order({ id: 'current', jy: 1405, jm: 8, jd: 10 }),
      order({ id: 'other', employeeId: 'user-2', jy: 1405, jm: 8, jd: 11 }),
      order({ id: 'bad', jy: 0, jm: 0, jd: 0, choice: null, snapshotTitle: 'آش' }),
    ]
    const split = partitionMyOrders(items, 'user-1', aban)
    expect(split.current.map((item) => item.id)).toEqual(['current'])
    expect(split.past.map((item) => item.id)).toEqual(['past'])
    expect(split.future.map((item) => item.id)).toEqual(['future'])
    expect(split.invalid.map((item) => item.id)).toEqual(['bad'])
  })

  it('treats the viewed month as future when looking from an earlier month, and past from a later month', () => {
    const current = order({ id: 'aban', jy: 1405, jm: 8, jd: 20 })
    expect(partitionMyOrders([current], 'user-1', { jy: 1405, jm: 7 }).future.map((item) => item.id)).toEqual(['aban'])
    expect(partitionMyOrders([current], 'user-1', { jy: 1405, jm: 9 }).past.map((item) => item.id)).toEqual(['aban'])
  })
})

describe('daysForMyOrders', () => {
  const menuDay: DayMenu = {
    jy: 1405,
    jm: 8,
    jd: 3,
    weekday: 'یکشنبه',
    lunch: ['جوجه'],
    dinner: null,
  }

  it('keeps menu days without orders and adds ordered days that are missing from the published menu', () => {
    const days = daysForMyOrders(
      [menuDay],
      [order({ id: 'orphan', jy: 1405, jm: 8, jd: 8, snapshotTitle: 'قیمه', choice: 'قیمه' })],
      aban,
    )
    expect(days.map((day) => day.jd)).toEqual([8, 3])
    expect(days[0]?.lunch).toBeNull()
    expect(days[1]?.lunch).toEqual(['جوجه'])
  })

  it('does not drop an order just because the published month is empty', () => {
    const days = daysForMyOrders([], [order({ id: 'keep', jy: 1405, jm: 8, jd: 12 })], aban)
    expect(days).toHaveLength(1)
    expect(days[0]?.jd).toBe(12)
  })
})

describe('mealDisplayName', () => {
  it('prefers the stored snapshot when the current menu no longer has that day', () => {
    const active = order({ id: 'o1', jy: 1405, jm: 8, jd: 1, choice: null, snapshotTitle: 'چلوکباب', cycleStatus: 'ACTIVE' })
    expect(mealDisplayName(false, active, undefined)).toEqual({ name: 'چلوکباب', missing: false })
  })

  it('keeps cancelled history as a note source without treating it as an active choice', () => {
    const cancelled = order({ id: 'c1', jy: 1405, jm: 8, jd: 1, choice: null, snapshotTitle: 'عدسی', cycleStatus: 'CANCELLED' })
    expect(mealDisplayName(true, undefined, cancelled)).toEqual({ name: null, missing: false })
    expect(mealDisplayName(false, undefined, cancelled)).toEqual({ name: 'عدسی', missing: false })
  })
})

describe('meal date conversion', () => {
  it('converts date-only Gregorian meal dates without a JavaScript Date timezone shift', () => {
    expect(jalaliFromMealDate('2026-03-20')).toEqual({ jy: 1404, jm: 12, jd: 29 })
    expect(jalaliFromMealDate('2026-03-21')).toEqual({ jy: 1405, jm: 1, jd: 1 })
    expect(formatGregorianDate(1404, 12, 29)).toBe('2026-03-20')
    expect(formatGregorianDate(1405, 1, 1)).toBe('2026-03-21')
    expect(jalaliFromMealDate('2026-02-31')).toBeNull()
    expect(jalaliFromJalaliField('1405/08/01')).toEqual({ jy: 1405, jm: 8, jd: 1 })
    expect(jalaliFromJalaliField('1405-08-01')).toEqual({ jy: 1405, jm: 8, jd: 1 })
  })
})
