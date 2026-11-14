export interface JalaliDate {
  jy: number
  jm: number
  jd: number
}

export interface JalaliDateTime extends JalaliDate {
  hour: number
  minute: number
}

export const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'] as const

export const PERSIAN_WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'] as const

const LEAP_REMAINDERS = new Set([1, 5, 9, 13, 17, 22, 26, 30])

export function isLeapJalali(jy: number) {
  return LEAP_REMAINDERS.has(((jy % 33) + 33) % 33)
}

export function jalaliMonthLength(jy: number, jm: number) {
  if (jm < 1 || jm > 12) return 0
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  return isLeapJalali(jy) ? 30 : 29
}

export function isValidJalaliDate(jy: number, jm: number, jd: number) {
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) return false
  const length = jalaliMonthLength(jy, jm)
  return length > 0 && jd >= 1 && jd <= length
}

export function monthKey(month: Pick<JalaliDate, 'jy' | 'jm'>) {
  return `${month.jy}-${month.jm}`
}

export function monthTitle(month: Pick<JalaliDate, 'jy' | 'jm'>) {
  return `${JALALI_MONTHS[month.jm - 1]} ${month.jy}`
}

export function dateKey(date: JalaliDate) {
  return date.jy * 10000 + date.jm * 100 + date.jd
}

export function compareDates(a: JalaliDate, b: JalaliDate) {
  return dateKey(a) - dateKey(b)
}

export function isSameDate(a: JalaliDate, b: JalaliDate) {
  return dateKey(a) === dateKey(b)
}

export function isSameMonth(a: Pick<JalaliDate, 'jy' | 'jm'>, b: Pick<JalaliDate, 'jy' | 'jm'>) {
  return a.jy === b.jy && a.jm === b.jm
}

function div(value: number, by: number) {
  return Math.trunc(value / by)
}

export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  const dayOffset = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  const gy2 = gm > 2 ? gy + 1 : gy
  let days = 355666 + (365 * gy) + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) + gd + dayOffset[gm - 1]
  let jy = -1595 + (33 * div(days, 12053))
  days %= 12053
  jy += 4 * div(days, 1461)
  days %= 1461
  if (days > 365) {
    jy += div(days - 1, 365)
    days = (days - 1) % 365
  }
  if (days < 186) {
    return { jy, jm: 1 + div(days, 31), jd: 1 + (days % 31) }
  }
  return { jy, jm: 7 + div(days - 186, 30), jd: 1 + ((days - 186) % 30) }
}

export function jalaliToGregorian(jy: number, jm: number, jd: number) {
  const jy2 = jy + 1595
  let days = -355668 + (365 * jy2) + (div(jy2, 33) * 8) + div(((jy2 % 33) + 3), 4) + jd + (jm < 7 ? (jm - 1) * 31 : ((jm - 7) * 30) + 186)
  let gy = 400 * div(days, 146097)
  days %= 146097
  if (days > 36524) {
    gy += 100 * div(--days, 36524)
    days %= 36524
    if (days >= 365) days++
  }
  gy += 4 * div(days, 1461)
  days %= 1461
  if (days > 365) {
    gy += div(days - 1, 365)
    days = (days - 1) % 365
  }
  let gd = days + 1
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0
  const months = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let gm = 1
  for (gm = 1; gm <= 12 && gd > months[gm]; gm++) gd -= months[gm]
  return { gy, gm, gd }
}

export function addDays(date: JalaliDate, amount: number): JalaliDate {
  const gregorian = jalaliToGregorian(date.jy, date.jm, date.jd)
  const utc = new Date(Date.UTC(gregorian.gy, gregorian.gm - 1, gregorian.gd + amount))
  return gregorianToJalali(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate())
}

export function addMonths(month: Pick<JalaliDate, 'jy' | 'jm'>, amount: number): Pick<JalaliDate, 'jy' | 'jm'> {
  const index = month.jy * 12 + (month.jm - 1) + amount
  const normalized = ((index % 12) + 12) % 12
  return { jy: Math.floor(index / 12), jm: normalized + 1 }
}

export function weekdayIndex(date: JalaliDate) {
  const gregorian = jalaliToGregorian(date.jy, date.jm, date.jd)
  const utcDay = new Date(Date.UTC(gregorian.gy, gregorian.gm - 1, gregorian.gd)).getUTCDay()
  return (utcDay + 1) % 7
}

export function weekdayName(date: JalaliDate) {
  return PERSIAN_WEEKDAYS[weekdayIndex(date)]
}

export function currentDateTime(): JalaliDateTime {
  const now = new Date()
  const date = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate())
  return { ...date, hour: now.getHours(), minute: now.getMinutes() }
}

export function isPastDate(date: JalaliDate, today: JalaliDate) {
  return compareDates(date, today) < 0
}

export function isFutureDate(date: JalaliDate, today: JalaliDate) {
  return compareDates(date, today) > 0
}
