import { isPastDate, JALALI_MONTHS, type JalaliDate, type JalaliDateTime } from './jalali'
import { formatDeadline, isOrderingOpen, type MonthDeadlines } from './deadlines'
import { fa } from './text'
import type { DayMenu, MealKind, MenuQuery, Order } from '../types'

export function findOrder(
  orders: Order[],
  employeeId: string,
  month: Pick<JalaliDate, 'jy' | 'jm'>,
  jd: number,
  meal: MealKind,
) {
  return orders.find((item) => item.employeeId === employeeId && item.jy === month.jy && item.jm === month.jm && item.jd === jd && item.meal === meal)
}

export function mealDate(day: Pick<DayMenu, 'jy' | 'jm' | 'jd'>): JalaliDate {
  return { jy: day.jy, jm: day.jm, jd: day.jd }
}

export function isMealOpen(day: DayMenu, meal: MealKind, deadlines: MonthDeadlines, now: JalaliDateTime) {
  if (!day[meal]) return false
  return isOrderingOpen(mealDate(day), deadlines[meal], now)
}

export function canGiveFeedback(order: Order | undefined, today: JalaliDate) {
  if (!order?.choice) return false
  return isPastDate({ jy: order.jy, jm: order.jm, jd: order.jd }, today)
}

function toLatin(value: string) {
  return value.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
}

export function matchesStatus(
  day: DayMenu,
  order: Order | undefined,
  meal: MealKind,
  status: MenuQuery['status'],
  deadlines: MonthDeadlines,
  now: JalaliDateTime,
) {
  if (!day[meal]) return false
  const selected = Boolean(order?.choice)
  if (status === 'selected') return selected
  if (status === 'unselected') return !selected
  if (status === 'open') return isMealOpen(day, meal, deadlines, now)
  return true
}

export function rowMatches(
  day: DayMenu,
  orders: Order[],
  employeeId: string,
  query: MenuQuery,
  deadlines: MonthDeadlines,
  now: JalaliDateTime,
) {
  const meals: MealKind[] = query.meal === 'all' ? ['lunch', 'dinner'] : [query.meal]
  const q = toLatin(query.q.trim())
  if (q) {
    const label = `${day.jd} ${JALALI_MONTHS[day.jm - 1]}`
    const blob = [String(day.jd), fa(day.jd), label, day.weekday, ...(day.lunch ?? []), ...(day.dinner ?? [])].join(' ')
    if (!toLatin(blob).includes(q)) return false
  }
  if (query.status === 'all') return true
  return meals.some((meal) => matchesStatus(day, findOrder(orders, employeeId, day, day.jd, meal), meal, query.status, deadlines, now))
}

export function deadlineLabel(day: DayMenu, meal: MealKind, deadlines: MonthDeadlines) {
  if (!day[meal]) return 'منو تعریف نشده'
  return formatDeadline(deadlines[meal])
}
