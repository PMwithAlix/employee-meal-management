export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

const DIGITS = '۰۱۲۳۴۵۶۷۸۹'

export function fa(value: number | string) {
  return String(value).replace(/\d/g, (digit) => DIGITS[Number(digit)] ?? digit)
}

export function faBytes(size: number) {
  if (size < 1024) return `${fa(size)} بایت`
  const kb = (size / 1024).toFixed(1).replace('.', '٫')
  return `${fa(kb)} کیلوبایت`
}
