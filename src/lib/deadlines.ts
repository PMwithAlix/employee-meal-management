import { addDays, dateKey, isPastDate, type JalaliDate, type JalaliDateTime } from './jalali'
import { fa } from './text'
import type { MealKind } from '../types'

export type DeadlineRelation = 'same_day' | 'previous_day'

export interface MealDeadline {
  meal: MealKind
  relation: DeadlineRelation
  hour: number
  minute: number
}

export interface MonthDeadlines {
  lunch: MealDeadline
  dinner: MealDeadline
}

export function defaultMonthDeadlines(): MonthDeadlines {
  return {
    lunch: { meal: 'lunch', relation: 'same_day', hour: 10, minute: 0 },
    dinner: { meal: 'dinner', relation: 'same_day', hour: 10, minute: 0 },
  }
}

export function resolveDeadline(mealDate: JalaliDate, deadline: MealDeadline): JalaliDateTime {
  const date = deadline.relation === 'previous_day' ? addDays(mealDate, -1) : mealDate
  return { ...date, hour: deadline.hour, minute: deadline.minute }
}

function timeKey(value: JalaliDateTime) {
  return dateKey(value) * 10000 + value.hour * 60 + value.minute
}

export function isOrderingOpen(mealDate: JalaliDate, deadline: MealDeadline, now: JalaliDateTime) {
  if (isPastDate(mealDate, now)) return false
  const deadlineAt = resolveDeadline(mealDate, deadline)
  return timeKey(now) < timeKey(deadlineAt)
}

export function formatDeadline(deadline: MealDeadline) {
  const when = deadline.relation === 'previous_day' ? 'روز قبل' : 'همان روز'
  const hour = fa(String(deadline.hour).padStart(2, '0'))
  const minute = fa(String(deadline.minute).padStart(2, '0'))
  return `${when}، ساعت ${hour}:${minute}`
}
