import { compareDates, dateKey, JALALI_MONTHS, type JalaliDate, type JalaliDateTime } from './jalali'
import { formatDeadline, isOrderingOpen, type MonthDeadlines } from './deadlines'
import { fa } from './text'
import type { DayMenu, MealKind, MealServings, MenuQuery, Order } from '../types'

function mealOrders(
  orders: Order[],
  employeeId: string,
  month: Pick<JalaliDate, 'jy' | 'jm'>,
  jd: number,
  meal: MealKind,
) {
  return orders.filter((item) => item.employeeId === employeeId && item.jy === month.jy && item.jm === month.jm && item.jd === jd && item.meal === meal)
}

export function findOrder(
  orders: Order[],
  employeeId: string,
  month: Pick<JalaliDate, 'jy' | 'jm'>,
  jd: number,
  meal: MealKind,
) {
  return mealOrders(orders, employeeId, month, jd, meal).find((item) => item.cycleStatus !== 'CANCELLED')
}

export function findCancelledOrder(
  orders: Order[],
  employeeId: string,
  month: Pick<JalaliDate, 'jy' | 'jm'>,
  jd: number,
  meal: MealKind,
) {
  return mealOrders(orders, employeeId, month, jd, meal).find((item) => item.cycleStatus === 'CANCELLED')
}

export function mealChoices(day: DayMenu, meal: MealKind) {
  return meal === 'lunch' ? day.lunchChoices ?? null : day.dinnerChoices ?? null
}

export function mealDate(day: Pick<DayMenu, 'jy' | 'jm' | 'jd'>): JalaliDate {
  return { jy: day.jy, jm: day.jm, jd: day.jd }
}

export type MealDeadlineState = 'unknown' | 'absent' | { at: string }
export type EmployeeDeadlineKind = 'unknown' | 'absent' | 'open' | 'elapsed'

export function classifyEmployeeDeadline(state: MealDeadlineState, now = new Date()): EmployeeDeadlineKind {
  if (state === 'unknown') return 'unknown'
  if (state === 'absent') return 'absent'
  const at = Date.parse(state.at)
  if (Number.isNaN(at)) return 'unknown'
  return now.getTime() < at ? 'open' : 'elapsed'
}

export function isEmployeeDeadlineOpen(state: MealDeadlineState, now = new Date()) {
  return classifyEmployeeDeadline(state, now) === 'open'
}

function definedMeals(day: DayMenu) {
  return (['lunch', 'dinner'] as const).filter((meal) => Boolean(day[meal]))
}

export function isOpenDeadlineDay(
  day: DayMenu,
  deadlineFor: (day: DayMenu, meal: MealKind) => MealDeadlineState,
  now = new Date(),
) {
  return definedMeals(day).some((meal) => classifyEmployeeDeadline(deadlineFor(day, meal), now) === 'open')
}

export function isElapsedDeadlineDay(
  day: DayMenu,
  deadlineFor: (day: DayMenu, meal: MealKind) => MealDeadlineState,
  now = new Date(),
) {
  const meals = definedMeals(day)
  if (meals.length === 0) return false
  const kinds = meals.map((meal) => classifyEmployeeDeadline(deadlineFor(day, meal), now))
  if (kinds.some((kind) => kind === 'unknown')) return false
  return kinds.every((kind) => kind !== 'open')
}

export function isMealOpen(day: DayMenu, meal: MealKind, deadlines: MonthDeadlines, now: JalaliDateTime, deadline?: MealDeadlineState) {
  if (!day[meal]) return false
  if (deadline !== undefined) return isEmployeeDeadlineOpen(deadline)
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
  deadline?: MealDeadlineState,
) {
  if (!day[meal]) return false
  const selected = Boolean(order?.choice)
  if (status === 'selected') return selected
  if (status === 'unselected') return !selected
  if (status === 'open') return isMealOpen(day, meal, deadlines, now, deadline)
  return true
}

export function rowMatches(
  day: DayMenu,
  orders: Order[],
  employeeId: string,
  query: MenuQuery,
  deadlines: MonthDeadlines,
  now: JalaliDateTime,
  deadlineFor?: (day: DayMenu, meal: MealKind) => MealDeadlineState,
) {
  const meals: MealKind[] = query.meal === 'all' ? ['lunch', 'dinner'] : [query.meal]
  const q = toLatin(query.q.trim())
  if (q) {
    const label = `${day.jd} ${JALALI_MONTHS[day.jm - 1]}`
    const blob = [String(day.jd), fa(day.jd), label, day.weekday, ...(day.lunch ?? []), ...(day.dinner ?? [])].join(' ')
    if (!toLatin(blob).includes(q)) return false
  }
  if (query.status === 'all') return true
  return meals.some((meal) => matchesStatus(day, findOrder(orders, employeeId, day, day.jd, meal), meal, query.status, deadlines, now, deadlineFor?.(day, meal)))
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
