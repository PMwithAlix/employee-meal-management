import { dateLabel } from '../data'
import { fa } from './text'
import type { DayMenu, MealKind, MenuQuery, Order } from '../types'

export function findOrder(orders: Order[], employeeId: string, jd: number, meal: MealKind) {
  return orders.find((item) => item.employeeId === employeeId && item.jd === jd && item.meal === meal)
}

export function isLocked(jd: number, today: number) {
  return jd < today
}

function toLatin(value: string) {
  return value.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
}

export function matchesStatus(day: DayMenu, order: Order | undefined, meal: MealKind, status: MenuQuery['status'], today: number) {
  if (!day[meal]) return false
  const selected = Boolean(order?.choice)
  if (status === 'selected') return selected
  if (status === 'unselected') return !selected
  if (status === 'open') return !isLocked(day.jd, today)
  return true
}

export function rowMatches(day: DayMenu, orders: Order[], employeeId: string, query: MenuQuery, today: number) {
  const meals: MealKind[] = query.meal === 'all' ? ['lunch', 'dinner'] : [query.meal]
  const q = toLatin(query.q.trim())
  if (q) {
    const blob = [String(day.jd), fa(day.jd), dateLabel(day.jd), day.weekday, ...(day.lunch ?? []), ...(day.dinner ?? [])].join(' ')
    if (!toLatin(blob).includes(q)) return false
  }
  if (query.status === 'all') return true
  return meals.some((meal) => matchesStatus(day, findOrder(orders, employeeId, day.jd, meal), meal, query.status, today))
}

export function deadlineText(jd: number, today: number, hour: number) {
  const hh = fa(hour)
  if (jd < today) return 'مهلت به پایان رسیده'
  if (jd === today) return `امروز تا ساعت ${hh}`
  const distance = jd - today
  if (distance === 1) return `فردا، ساعت ${hh}`
  return `${fa(distance)} روز دیگر، ساعت ${hh}`
}
