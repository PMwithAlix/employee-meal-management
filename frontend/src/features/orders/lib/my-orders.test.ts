import { describe, expect, it } from 'vitest'
import { formatGregorianDate, jalaliFromJalaliField, jalaliFromMealDate } from '../../menus/lib/menu-mapper'
import type { Order } from '../../../shared/types/domain'
import {
  MY_ORDERS_PAGE_SIZE,
  feedbackEligibleOrders,
  isFeedbackEligibleOrder,
  orderFoodName,
  orderMealLabel,
  paginateOrders,
} from './my-orders'

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

const servings = { lunch: '12:00', dinner: '19:00' }
const now = { jy: 1405, jm: 8, jd: 10, hour: 13, minute: 0 }

describe('feedbackEligibleOrders', () => {
  it('keeps only the current user\'s active meals whose serving time has ended', () => {
    const items = [
      order({ id: 'served-lunch', jy: 1405, jm: 8, jd: 10, meal: 'lunch' }),
      order({ id: 'future-dinner', jy: 1405, jm: 8, jd: 10, meal: 'dinner' }),
      order({ id: 'tomorrow', jy: 1405, jm: 8, jd: 11 }),
      order({ id: 'cancelled', jy: 1405, jm: 8, jd: 9, choice: null, cycleStatus: 'CANCELLED' }),
      order({ id: 'unselected', jy: 1405, jm: 8, jd: 9, choice: null }),
      order({ id: 'other', employeeId: 'user-2', jy: 1405, jm: 8, jd: 9 }),
      order({ id: 'past-dinner', jy: 1405, jm: 8, jd: 9, meal: 'dinner' }),
      order({ id: 'past-lunch', jy: 1405, jm: 8, jd: 9, meal: 'lunch' }),
      order({ id: 'invalid', jy: 0, jm: 0, jd: 0 }),
    ]
    expect(feedbackEligibleOrders(items, 'user-1', now, servings).map((item) => item.id)).toEqual([
      'served-lunch',
      'past-dinner',
      'past-lunch',
    ])
  })

  it('does not use the selected month and treats lunch and dinner as separate orders', () => {
    const lunch = order({ id: 'lunch', jy: 1405, jm: 7, jd: 20, meal: 'lunch' })
    const dinner = order({ id: 'dinner', jy: 1405, jm: 7, jd: 20, meal: 'dinner' })
    const listed = feedbackEligibleOrders([lunch, dinner], 'user-1', now, servings)
    expect(listed.map((item) => item.id)).toEqual(['dinner', 'lunch'])
  })

  it('drops duplicates and does not invent eligibility without a serving clock', () => {
    const served = order({ id: 'same', jy: 1405, jm: 8, jd: 1 })
    expect(feedbackEligibleOrders([served, served], 'user-1', now, servings)).toHaveLength(1)
    expect(isFeedbackEligibleOrder(served, 'user-1', now, { lunch: '', dinner: '19:00' })).toBe(false)
  })
})

describe('paginateOrders', () => {
  it('pages newest-first lists without overlapping rows', () => {
    const items = Array.from({ length: MY_ORDERS_PAGE_SIZE + 2 }, (_, index) => index)
    expect(paginateOrders(items, 1).items).toEqual(items.slice(0, 20))
    expect(paginateOrders(items, 2)).toMatchObject({ items: [20, 21], page: 2, pageCount: 2, total: 22 })
    expect(paginateOrders(items, 9).page).toBe(2)
    expect(paginateOrders([], 3)).toMatchObject({ items: [], page: 1, pageCount: 1, total: 0 })
  })
})

describe('order display helpers', () => {
  it('prefers the stored food title and labels meals separately', () => {
    expect(orderFoodName(order({ id: 'named', jy: 1405, jm: 8, jd: 1, choice: 'قیمه', snapshotTitle: 'عدسی' }))).toBe('قیمه')
    expect(orderFoodName(order({ id: 'snap', jy: 1405, jm: 8, jd: 1, choice: null, snapshotTitle: 'آش' }))).toBe('آش')
    expect(orderMealLabel('lunch')).toBe('ناهار')
    expect(orderMealLabel('dinner')).toBe('شام')
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
