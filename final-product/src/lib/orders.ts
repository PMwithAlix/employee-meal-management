import { compareDates, dateKey, JALALI_MONTHS, type JalaliDate, type JalaliDateTime } from './jalali'
import { formatDeadline, isOrderingOpen, type MonthDeadlines } from './deadlines'
import { fa } from './text'
import type { DayMenu, MealKind, MealServings, MenuQuery, Order } from '../types'

export function findOrder(
  orders: Order[],
  employeeId: string,
  month: Pick<JalaliDate, 'jy' | 'jm'>,
  jd: number,
  meal: MealKind,
) {
  const matches = orders.filter((item) => item.employeeId === employeeId && item.jy === month.jy && item.jm === month.jm && item.jd === jd && item.meal === meal)
  return matches.find((item) => item.cycleStatus !== 'CANCELLED') ?? matches[0]
}

export function mealChoices(day: DayMenu, meal: MealKind) {
  return meal === 'lunch' ? day.lunchChoices ?? null : day.dinnerChoices ?? null
}

export function mealDate(day: Pick<DayMenu, 'jy' | 'jm' | 'jd'>): JalaliDate {
  return { jy: day.jy, jm: day.jm, jd: day.jd }
}

export function isMealOpen(day: DayMenu, meal: MealKind, deadlines: MonthDeadlines, now: JalaliDateTime, deadlineAt?: string | null) {
  if (!day[meal]) return false
  if (deadlineAt) {
    const at = Date.parse(deadlineAt)
    return Number.isNaN(at) ? false : Date.now() < at
  }
  return isOrderingOpen(mealDate(day), deadlines[meal], now)
}

function parseServing(value: string): readonly [number, number] {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!match) return [12, 0]
  return [Number(match[1]), Number(match[2])]
}

export function canGiveFeedback(order: Order | undefined, now: JalaliDateTime, servings: MealServings) {
  if (!order?.choice) return false
  const [hour, minute] = parseServing(servings[order.meal])
  return clockKey(order, hour, minute) < clockKey(now, now.hour, now.minute)
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

function clockKey(date: JalaliDate, hour: number, minute: number) {
  return dateKey(date) * 10000 + hour * 60 + minute
}

export function isUpcomingMeal(order: Pick<Order, 'jy' | 'jm' | 'jd' | 'meal'>, now: JalaliDateTime, servings: MealServings) {
  const [hour, minute] = parseServing(servings[order.meal])
  return clockKey(order, hour, minute) > clockKey(now, now.hour, now.minute)
}

export function compareMeals(a: Pick<Order, 'jy' | 'jm' | 'jd' | 'meal'>, b: Pick<Order, 'jy' | 'jm' | 'jd' | 'meal'>) {
  const date = compareDates(a, b)
  if (date !== 0) return date
  return a.meal === b.meal ? 0 : a.meal === 'lunch' ? -1 : 1
}

export function upcomingChosenMeals(orders: Order[], employeeId: string, now: JalaliDateTime, servings: MealServings, limit = 3) {
  return orders
    .filter((order) => order.employeeId === employeeId && Boolean(order.choice) && isUpcomingMeal(order, now, servings))
    .sort(compareMeals)
    .slice(0, limit)
}
