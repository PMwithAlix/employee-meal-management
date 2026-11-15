import { gregorianToJalali, isValidJalaliDate, jalaliToGregorian, type JalaliDate } from './jalali'

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function jalaliFromIsoDate(value: string): JalaliDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const gy = Number(match[1])
  const gm = Number(match[2])
  const gd = Number(match[3])
  if (!Number.isInteger(gy) || gm < 1 || gm > 12 || gd < 1 || gd > 31) return null
  const jalali = gregorianToJalali(gy, gm, gd)
  return isValidJalaliDate(jalali.jy, jalali.jm, jalali.jd) ? jalali : null
}

export function isoDateFromJalali(date: JalaliDate): string | null {
  if (!isValidJalaliDate(date.jy, date.jm, date.jd)) return null
  const { gy, gm, gd } = jalaliToGregorian(date.jy, date.jm, date.jd)
  return `${gy}-${pad(gm)}-${pad(gd)}`
}

export function formatJalaliInput(value: string) {
  const jalali = jalaliFromIsoDate(value)
  if (!jalali) return ''
  return `${jalali.jy}/${pad(jalali.jm)}/${pad(jalali.jd)}`
}
