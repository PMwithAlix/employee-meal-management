import { compareDates, isValidJalaliDate, type JalaliDate } from '../../shared/lib/jalali'
import type { Order } from '../../shared/types/domain'

export type OrderBucket = 'upcoming' | 'past' | 'undated'

export function orderBucket(order: Order, today: JalaliDate): OrderBucket {
  if (!isValidJalaliDate(order.jy, order.jm, order.jd)) return 'undated'
  return compareDates(order, today) < 0 ? 'past' : 'upcoming'
}

export function splitOrdersByMealDate(orders: Order[], today: JalaliDate) {
  const upcoming: Order[] = []
  const past: Order[] = []
  const undated: Order[] = []
  for (const order of orders) {
    const bucket = orderBucket(order, today)
    if (bucket === 'upcoming') upcoming.push(order)
    else if (bucket === 'past') past.push(order)
    else undated.push(order)
  }
  upcoming.sort((left, right) => compareDates(left, right))
  past.sort((left, right) => compareDates(right, left))
  return { upcoming, past, undated }
}
