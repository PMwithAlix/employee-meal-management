import { addDays, dateKey, isPastDate, type JalaliDate, type JalaliDateTime } from './jalali'
import { fa } from './persian-text'
import type { MealKind } from '../types/domain'

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

export function formatOrderDeadlineSentence(deadline: MealDeadline) {
  const meal = deadline.meal === 'lunch' ? 'ناهار' : 'شام'
  const hour = fa(String(deadline.hour).padStart(2, '0'))
  const minute = fa(String(deadline.minute).padStart(2, '0'))
  if (deadline.relation === 'previous_day') {
    return `مهلت ثبت سفارش ${meal}، ساعت ${hour}:${minute} روز قبل از تاریخ وعده است.`
  }
  return `مهلت ثبت سفارش ${meal}، ساعت ${hour}:${minute} در همان روز وعده است.`
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

export function tehranWallToUtc(ymd: string, hours: number, minutes: number, seconds = 0) {
  const [year, month, day] = ymd.split('-').map(Number)
  let utc = Date.UTC(year, month - 1, day, hours, minutes, seconds) - 3.5 * 3600 * 1000
  for (let i = 0; i < 6; i += 1) {
    const parts = tehranDateTimeParts(new Date(utc).toISOString())
    if (!parts) break
    const target = Date.UTC(year, month - 1, day, hours, minutes, seconds)
    const actual = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, seconds)
    const delta = target - actual
    utc += delta
    if (delta === 0) break
  }
  return new Date(utc)
}

export function deadlineAtFromPattern(mealDate: string, deadline: MealDeadline) {
  const [gy, gm, gd] = mealDate.split('-').map(Number)
  const wall = deadline.relation === 'previous_day'
    ? new Date(Date.UTC(gy, gm - 1, gd - 1))
    : new Date(Date.UTC(gy, gm - 1, gd))
  const ymd = `${wall.getUTCFullYear()}-${String(wall.getUTCMonth() + 1).padStart(2, '0')}-${String(wall.getUTCDate()).padStart(2, '0')}`
  return tehranWallToUtc(ymd, deadline.hour, deadline.minute).toISOString()
}

export function inferMealDeadline(map: Record<string, string | null>, meal: MealKind, mealDates: string[]): MealDeadline | null {
  if (mealDates.length === 0) return null
  const suffix = meal === 'lunch' ? ':LUNCH' : ':DINNER'
  let inferred: MealDeadline | null = null
  for (const mealDate of mealDates) {
    const key = `${mealDate}${suffix}`
    if (!Object.prototype.hasOwnProperty.call(map, key) || !map[key]) return null
    const parts = tehranDateTimeParts(map[key]!)
    if (!parts) return null
    const [gy, gm, gd] = mealDate.split('-').map(Number)
    const relation: DeadlineRelation = Date.UTC(parts.year, parts.month - 1, parts.day) < Date.UTC(gy, gm - 1, gd) ? 'previous_day' : 'same_day'
    const next = { meal, relation, hour: parts.hour, minute: parts.minute }
    if (!inferred) inferred = next
    else if (inferred.relation !== next.relation || inferred.hour !== next.hour || inferred.minute !== next.minute) return null
  }
  return inferred
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

export function summarizeBackendDeadlines(map: Record<string, string | null>, meal: MealKind, mealDates: string[]) {
  const suffix = meal === 'lunch' ? ':LUNCH' : ':DINNER'
  if (mealDates.length === 0) return 'مهلت تعریف نشده'
  const labels = new Set<string>()
  let missing = 0
  let unknown = false
  for (const mealDate of mealDates) {
    const key = `${mealDate}${suffix}`
    if (!Object.prototype.hasOwnProperty.call(map, key)) {
      missing += 1
      continue
    }
    const iso = map[key]
    const label = iso ? formatDeadlineFromInstant(iso, mealDate) : null
    if (!label) {
      unknown = true
      continue
    }
    labels.add(label)
  }
  if (unknown) return 'وضعیت مهلت قابل تشخیص نیست'
  if (missing === mealDates.length) return 'مهلت تعریف نشده'
  if (missing > 0) return 'بعضی روزها مهلت ندارند'
  if (labels.size === 1) return [...labels][0]
  return 'ساعت‌های متفاوت'
}
