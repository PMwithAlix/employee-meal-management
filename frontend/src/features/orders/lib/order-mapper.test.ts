import { describe, expect, it } from 'vitest'
import { classifyEmployeeDeadline, isEmployeeDeadlineOpen, isMealOpen } from '../../../shared/lib/order-rules'
import { currentDateTime } from '../../../shared/lib/jalali'
import { defaultMonthDeadlines } from '../../../shared/lib/deadlines'
import type { DayMenu } from '../../../shared/types/domain'
import { deadlineKey, isDeadlineOpen, mealDeadlineFromMap, mealServingsFromSettings, parseBackendOrder, parseDeadline, parseMealSetting, parseStaffRating, toDeadlineMap, toUiOrder } from './order-mapper'
import { partitionMyOrders } from './my-orders'

const payload = {
  id: 'order-1',
  userId: 'user-1',
  mealDate: '2026-10-23',
  jalaliDate: '1405-08-01',
  mealType: 'LUNCH',
  quantity: 1,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  status: 'ACTIVE',
  currentCycle: {
    id: 'cycle-1',
    cycleNumber: 1,
    menuItemId: 'item-uuid',
    menuVersionId: 'ver-1',
    optionTitle: 'چلوکباب',
    usernameSnapshot: 'e2e.order.employee',
    buildingIdSnapshot: 'b1',
    buildingNameSnapshot: 'اصلی',
    mealDateSnapshot: '2026-10-23',
    mealTypeSnapshot: 'LUNCH',
    status: 'ACTIVE',
    createdAt: '2026-11-01T00:00:00.000Z',
    groups: [{ groupId: 'g1', groupNameSnapshot: 'گروه الف' }],
  },
  rating: null,
}

describe('parseBackendOrder', () => {
  it('keeps option identity from currentCycle.menuItemId', () => {
    const parsed = parseBackendOrder(payload)
    expect(parsed?.currentCycle?.menuItemId).toBe('item-uuid')
    expect(parsed?.currentCycle?.optionTitle).toBe('چلوکباب')
    const ui = toUiOrder(parsed!)
    expect(ui?.menuItemId).toBe('item-uuid')
    expect(ui?.choice).toBe('چلوکباب')
    expect(ui?.meal).toBe('lunch')
    expect(ui?.rating).toBeNull()
  })

  it('keeps a previously saved rating on the order after mapping', () => {
    const ui = toUiOrder(parseBackendOrder({
      ...payload,
      rating: { id: 'r1', score: 4, comment: 'خوب', createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' },
    })!)
    expect(ui?.rating).toEqual({ score: 4, comment: 'خوب' })
  })

  it('does not treat a cancelled cycle as a current choice', () => {
    const ui = toUiOrder(parseBackendOrder({ ...payload, status: 'CANCELLED', currentCycle: { ...payload.currentCycle, status: 'CANCELLED' } })!)
    expect(ui?.choice).toBeNull()
    expect(ui?.snapshotTitle).toBe('چلوکباب')
    expect(ui?.menuItemId).toBeNull()
    expect(ui?.cycleStatus).toBe('CANCELLED')
  })

  it('keeps the snapshot when the menu item id is no longer present', () => {
    const parsed = parseBackendOrder({ ...payload, currentCycle: { ...payload.currentCycle, menuItemId: null } })
    expect(parsed?.currentCycle?.optionTitle).toBe('چلوکباب')
    expect(parsed?.currentCycle?.menuItemId).toBeNull()
    const ui = toUiOrder(parsed!)
    expect(ui?.choice).toBe('چلوکباب')
    expect(ui?.snapshotTitle).toBe('چلوکباب')
    expect(ui?.menuItemId).toBeNull()
  })

  it('uses mealDate only and does not assign a month from jalaliDate', () => {
    const ui = toUiOrder(parseBackendOrder(payload)!)
    expect(ui).toMatchObject({ jy: 1405, jm: 8, jd: 1, snapshotTitle: 'چلوکباب' })
    const mismatched = toUiOrder(parseBackendOrder({ ...payload, jalaliDate: '1404/01/01' })!)
    expect(mismatched).toMatchObject({ jy: 1405, jm: 8, jd: 1 })
    const invalid = toUiOrder(parseBackendOrder({ ...payload, mealDate: 'not-a-date', jalaliDate: '1405/08/01' })!)
    expect(invalid).toMatchObject({ id: 'order-1', jy: 0, jm: 0, jd: 0, snapshotTitle: 'چلوکباب', cycleStatus: 'ACTIVE' })
    const emptyDate = toUiOrder(parseBackendOrder({ ...payload, mealDate: '', jalaliDate: '1405/08/01' })!)
    expect(emptyDate).toMatchObject({ jy: 0, jm: 0, jd: 0, snapshotTitle: 'چلوکباب' })
    const split = partitionMyOrders([invalid!], 'user-1', { jy: 1405, jm: 8 })
    expect(split.invalid.map((item) => item.id)).toEqual(['order-1'])
    expect(split.current).toEqual([])
    expect(split.past).toEqual([])
    expect(split.future).toEqual([])
  })
})

describe('deadlines', () => {
  it('builds a mealDate+type key and compares ISO deadlines', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(deadlineKey('2026-10-23', 'lunch')).toBe('2026-10-23:LUNCH')
    expect(isDeadlineOpen('2099-01-01T00:00:00.000Z', now)).toBe(true)
    expect(isDeadlineOpen('2020-01-01T00:00:00.000Z', now)).toBe(false)
    expect(isDeadlineOpen('2026-01-01T00:00:00.000Z', now)).toBe(false)
    expect(isDeadlineOpen('not-a-date', now)).toBe(false)
  })

  it('keeps an identifiable backend deadline whose timestamp cannot be parsed', () => {
    const row = {
      id: 'dl-1',
      mealDate: '2026-10-23',
      jalaliDate: '1405-08-01',
      mealType: 'LUNCH',
      deadlineAt: 'not-a-date',
      createdBy: 'user-1',
    }
    expect(parseDeadline(row)).toMatchObject({ mealDate: '2026-10-23', mealType: 'LUNCH', deadlineAt: null })
    expect(parseDeadline({ ...row, deadlineAt: '' })?.deadlineAt).toBeNull()
    expect(parseDeadline({ ...row, deadlineAt: '2026-10-23T06:30:00.000Z' })?.deadlineAt).toBe('2026-10-23T06:30:00.000Z')
  })
})

describe('ratings and meal settings', () => {
  it('parses a staff rating and serving clocks from the backend contract', () => {
    const rating = parseStaffRating({
      id: 'r1',
      orderId: 'order-1',
      orderCycleId: 'c1',
      score: 5,
      comment: 'عالی',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
      userId: 'user-1',
      mealDate: '2026-10-23',
      jalaliDate: '1405/08/01',
      mealType: 'LUNCH',
      usernameSnapshot: 'emp',
      mealTitleSnapshot: 'چلوکباب',
      buildingNameSnapshot: 'اصلی',
      cycleStatus: 'ACTIVE',
    })
    expect(rating?.orderId).toBe('order-1')
    expect(rating?.score).toBe(5)
    expect(parseMealSetting({ id: 's1', mealType: 'LUNCH', servingTime: '12:00', updatedBy: 'u1', updatedAt: '2026-11-01T00:00:00.000Z' })?.servingTime).toBe('12:00')
    expect(mealServingsFromSettings([
      { id: 's1', mealType: 'LUNCH', servingTime: '12:00', updatedBy: 'u1', updatedAt: '' },
      { id: 's2', mealType: 'DINNER', servingTime: '19:00', updatedBy: 'u1', updatedAt: '' },
    ])).toEqual({ lunch: '12:00', dinner: '19:00' })
  })
})

describe('deadline map lookup', () => {
  const now = new Date('2026-08-22T06:30:00.000Z')
  const day: DayMenu = {
    jy: 1405,
    jm: 8,
    jd: 1,
    weekday: 'شنبه',
    lunch: ['عدسی'],
    dinner: ['سوپ'],
    gregorianDate: '2026-10-23',
  }

  it('preserves absent, open, elapsed, and unknown from parse through the store map', () => {
    const rows = [
      parseDeadline({
        id: 'open-1',
        mealDate: '2026-10-23',
        mealType: 'LUNCH',
        deadlineAt: '2026-08-22T07:00:00.000Z',
        createdBy: 'user-1',
      }),
      parseDeadline({
        id: 'invalid-1',
        mealDate: '2026-10-23',
        mealType: 'DINNER',
        deadlineAt: 'not-a-date',
        createdBy: 'user-1',
      }),
      parseDeadline({
        id: 'elapsed-1',
        mealDate: '2026-10-24',
        mealType: 'LUNCH',
        deadlineAt: '2026-08-22T06:00:00.000Z',
        createdBy: 'user-1',
      }),
    ].filter((item): item is NonNullable<typeof item> => item !== null)
    const map = toDeadlineMap(rows)
    const lunch = mealDeadlineFromMap(map, true, '2026-10-23', 'lunch')
    const dinner = mealDeadlineFromMap(map, true, '2026-10-23', 'dinner')
    const elapsed = mealDeadlineFromMap(map, true, '2026-10-24', 'lunch')
    const absent = mealDeadlineFromMap(map, true, '2026-10-24', 'dinner')
    expect(classifyEmployeeDeadline(lunch, now)).toBe('open')
    expect(classifyEmployeeDeadline(dinner, now)).toBe('unknown')
    expect(classifyEmployeeDeadline(elapsed, now)).toBe('elapsed')
    expect(absent).toBe('absent')
    expect(isEmployeeDeadlineOpen(dinner, now)).toBe(false)
    expect(isMealOpen(day, 'dinner', defaultMonthDeadlines(), currentDateTime(), dinner)).toBe(false)
  })
})
