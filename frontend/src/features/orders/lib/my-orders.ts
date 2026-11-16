import { formatGregorianDate } from '../../menus/lib/menu-mapper'
import { compareMeals } from '../../../shared/lib/order-rules'
import { dateKey, isValidJalaliDate, jalaliMonthLength, weekdayName, type JalaliDate } from '../../../shared/lib/jalali'
import type { DayMenu, Order } from '../../../shared/types/domain'

export type OrderTimeBucket = 'current' | 'past' | 'future' | 'invalid'

export function monthBounds(month: Pick<JalaliDate, 'jy' | 'jm'>) {
  const length = jalaliMonthLength(month.jy, month.jm)
  if (length < 1) return null
  return {
    start: dateKey({ jy: month.jy, jm: month.jm, jd: 1 }),
    end: dateKey({ jy: month.jy, jm: month.jm, jd: length }),
  }
}

export function orderTimeBucket(
  order: Pick<Order, 'jy' | 'jm' | 'jd'>,
  month: Pick<JalaliDate, 'jy' | 'jm'>,
): OrderTimeBucket {
  if (!isValidJalaliDate(order.jy, order.jm, order.jd)) return 'invalid'
  const bounds = monthBounds(month)
  if (!bounds) return 'invalid'
  const key = dateKey(order)
  if (key < bounds.start) return 'past'
  if (key > bounds.end) return 'future'
  return 'current'
}

export function partitionMyOrders(
  orders: Order[],
  employeeId: string,
  month: Pick<JalaliDate, 'jy' | 'jm'>,
) {
  const current: Order[] = []
  const past: Order[] = []
  const future: Order[] = []
  const invalid: Order[] = []
  const seen = new Set<string>()
  for (const order of orders) {
    if (order.employeeId !== employeeId) continue
    if (seen.has(order.id)) continue
    seen.add(order.id)
    const bucket = orderTimeBucket(order, month)
    if (bucket === 'current') current.push(order)
    else if (bucket === 'past') past.push(order)
    else if (bucket === 'future') future.push(order)
    else invalid.push(order)
  }
  past.sort((left, right) => compareMeals(right, left))
  future.sort(compareMeals)
  invalid.sort((left, right) => left.id.localeCompare(right.id))
  return { current, past, future, invalid }
}

export function daysForMyOrders(
  pickerDays: DayMenu[],
  currentOrders: Order[],
  month: Pick<JalaliDate, 'jy' | 'jm'>,
) {
  const byJd = new Map<number, DayMenu>()
  for (const day of pickerDays) {
    if (day.jy !== month.jy || day.jm !== month.jm) continue
    if (day.lunch || day.dinner) byJd.set(day.jd, day)
  }
  for (const order of currentOrders) {
    if (!isValidJalaliDate(order.jy, order.jm, order.jd)) continue
    if (byJd.has(order.jd)) continue
    const date = { jy: order.jy, jm: order.jm, jd: order.jd }
    byJd.set(order.jd, {
      ...date,
      weekday: weekdayName(date),
      lunch: null,
      dinner: null,
      gregorianDate: formatGregorianDate(order.jy, order.jm, order.jd),
    })
  }
  return [...byJd.values()].sort((left, right) => right.jd - left.jd)
}

export function mealDisplayName(
  defined: boolean,
  order: Order | undefined,
  cancelled: Order | undefined,
) {
  if (order?.choice) return { name: order.choice, missing: false }
  if (order?.snapshotTitle && order.cycleStatus !== 'CANCELLED') {
    return { name: order.snapshotTitle, missing: false }
  }
  if (defined) return { name: order?.choice ?? null, missing: false }
  if (order || cancelled) {
    return { name: order?.snapshotTitle ?? cancelled?.snapshotTitle ?? '—', missing: false }
  }
  return { name: undefined, missing: true }
}
