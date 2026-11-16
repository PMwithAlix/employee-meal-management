import { canGiveFeedback, compareMeals } from '../../../shared/lib/order-rules'
import { isValidJalaliDate, weekdayName, type JalaliDateTime } from '../../../shared/lib/jalali'
import type { MealServings, Order } from '../../../shared/types/domain'

export const MY_ORDERS_PAGE_SIZE = 20

export function isFeedbackEligibleOrder(
  order: Order,
  employeeId: string,
  now: JalaliDateTime,
  servings: MealServings,
) {
  if (order.employeeId !== employeeId) return false
  if (order.cycleStatus === 'CANCELLED') return false
  if (!isValidJalaliDate(order.jy, order.jm, order.jd)) return false
  return canGiveFeedback(order, now, servings)
}

export function feedbackEligibleOrders(
  orders: Order[],
  employeeId: string,
  now: JalaliDateTime,
  servings: MealServings,
) {
  const seen = new Set<string>()
  const items: Order[] = []
  for (const order of orders) {
    if (seen.has(order.id)) continue
    seen.add(order.id)
    if (!isFeedbackEligibleOrder(order, employeeId, now, servings)) continue
    items.push(order)
  }
  items.sort((left, right) => compareMeals(right, left))
  return items
}

export function paginateOrders<T>(items: T[], page: number, pageSize = MY_ORDERS_PAGE_SIZE) {
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = (safePage - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    pageCount,
  }
}

export function orderMealLabel(meal: Order['meal']) {
  return meal === 'lunch' ? 'ناهار' : 'شام'
}

export function orderFoodName(order: Order) {
  return order.choice ?? order.snapshotTitle ?? '—'
}

export function orderWeekday(order: Pick<Order, 'jy' | 'jm' | 'jd'>) {
  return weekdayName(order)
}
