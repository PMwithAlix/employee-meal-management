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

const TEHRAN = 'Asia/Tehran'

export function tehranDateTimeParts(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TEHRAN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  const year = read('year')
  const month = read('month')
  const day = read('day')
  const hour = read('hour')
  const minute = read('minute')
  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) return null
  return { year, month, day, hour, minute }
}

export function formatDeadlineFromInstant(deadlineAt: string, mealDate?: string) {
  const parts = tehranDateTimeParts(deadlineAt)
  if (!parts) return null
  const hour = fa(String(parts.hour).padStart(2, '0'))
  const minute = fa(String(parts.minute).padStart(2, '0'))
  const clock = `ساعت ${hour}:${minute}`
  if (!mealDate) return clock
  const [gy, gm, gd] = mealDate.split('-').map(Number)
  if (!gy || !gm || !gd) return clock
  const when = Date.UTC(parts.year, parts.month - 1, parts.day) < Date.UTC(gy, gm - 1, gd) ? 'روز قبل' : 'همان روز'
  return `${when}، ${clock}`
}

export function summarizeBackendDeadlines(map: Record<string, string>, meal: MealKind, mealDates: string[]) {
  const suffix = meal === 'lunch' ? ':LUNCH' : ':DINNER'
  if (mealDates.length === 0) return 'مهلت تعریف نشده'
  const labels = new Set<string>()
  let missing = 0
  for (const mealDate of mealDates) {
    const iso = map[`${mealDate}${suffix}`]
    if (!iso) {
      missing += 1
      continue
    }
    const label = formatDeadlineFromInstant(iso, mealDate)
    if (label) labels.add(label)
    else missing += 1
  }
  if (missing === mealDates.length) return 'مهلت تعریف نشده'
  if (missing > 0) return 'بعضی روزها مهلت ندارند'
  if (labels.size === 1) return [...labels][0]
  return 'ساعت‌های متفاوت'
}
